import React, { useEffect, useState, useRef } from 'react';
import styles from './FileList.module.css';
import '../../styles/Editor.css';
import * as monaco from 'monaco-editor';
import { useDispatch, useSelector } from 'react-redux';
import { auth, db } from "../../../firebase.js";
import { getDoc, doc, setDoc } from "firebase/firestore";
import Divider from '@mui/material/Divider';
import { useLocation } from "react-router-dom";
import { 
  ActionIcon,
  Container,
  CopyButton,
  Group,
  NativeSelect,
  rem,
  Select,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  Tree,
  getBackendOptions,
  MultiBackend,
} from "@minoru/react-dnd-treeview";
import { DndProvider } from "react-dnd";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import { TEMPLATES } from './Templates.js';
import { TEMPLATE_CODE } from '../templates.js';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import {
  IconCheck,
  IconCopy,
  IconPlus,
  IconTrash
} from '@tabler/icons-react';

const initialData = [
  {
    "id": 1,
    "parent": 0,
    "droppable": true,
    "text": "Folder 1"
  },
  {
    "id": 2,
    "parent": 1,
    "text": "File 1-1",
    "data": {
      "language": "python"
    }
  },
  {
    "id": 3,
    "parent": 1,
    "text": "File 1-2",
    "data": {
      "language": "cpp"
    }
  },
  {
    "id": 4,
    "parent": 0,
    "droppable": true,
    "text": "Folder 2"
  },
  {
    "id": 5,
    "parent": 4,
    "droppable": true,
    "text": "Folder 2-1"
  },
  {
    "id": 6,
    "parent": 5,
    "text": "File 2-1-1",
    "data": {
      "language": "python"
    }
  }
];

const initialCode = {
  2: "print('File 1-1')",
  3: `#include <iostream>

int main() {
    std::cout << "Hello World!";
    return 0;
}`,
  6: "print('File 2-1-1')",
};

const FILE_EXTENSION = {
  python: ".py",
  java: ".java",
  cpp: ".cpp"
};

const drawerWidth = 240;

const LANGUAGE_ICON = {
    python: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-plain.svg",
    java: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-plain.svg",
    cpp: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-plain.svg"  
};


const FileList = (props) => {
  const [readCount, setReadCount] = useState(0);
  
  useEffect(() => {
    console.log("Filelist reads:", readCount);
  }, [readCount]);

  const fileTabs = useSelector(state => state.fileTabs);
  const activeTabIndex = useSelector(state => state.activeFileTab);

  const [filesOpen, setFilesOpen] = React.useState(false);



  const [state, setState] = React.useState({
    top: false,
    left: false,
    bottom: false,
    right: false,
  });

  const toggleDrawer = (anchor, open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }

    setState({ ...state, [anchor]: open });
  };

  const [expanded, setExpanded] = React.useState('');


  const [anchorEl, setAnchorEl] = React.useState(null);

  const [code, setCode] = useState(null);
  const [output, setOutput] = useState([]);
  const [language, setLanguage] = useState("cpp");
  const languageRef = useRef(language); // Create a ref for the language

  useEffect(() => {
    if (fileTabs[activeTabIndex]) {
      setCode(fileTabs[activeTabIndex].code);
    }
  }, [activeTabIndex]);

  // Update the ref whenever the language changes
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const inputData = useSelector(state => state.inputData);
  const outputData = useSelector(state => state.outputData);
  const [localInputData, setLocalInputData] = useState(inputData);
  const [localOutputData, setLocalOutputData] = useState(outputData);

  const dispatch = useDispatch();

  const editorRef = useRef(null);

  const [actions, setActions] = useState([]); 
  

  useEffect(() => {
      if (editorRef.current) {
          Object.entries(TEMPLATES).forEach(([label, templates], index) => {
              editorRef.current.addAction({
                  id: `insert-template-${index}`,
                  label: label,
                  keybindings: [
                      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | (monaco.KeyCode.KEY_1 + index),
                  ],
                  contextMenuGroupId: 'navigation',
                  contextMenuOrder: 1.5,
                  run: function(ed) {
                      const position = ed.getPosition();
                      ed.executeEdits("", [
                          {
                              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                              text: templates[languageRef.current] // Use the current value of the ref
                            }
                      ]);
                      return null;
                  }
              });
          });
      }
  }, [editorRef.current]);  

  const location = useLocation();
  const currentTab = useSelector(state => state.currentTab);
  const lessonProblemData = useSelector(state => state.lessonProblemData);
  const tabIndex = useSelector(state => state.lessonTabIndex);
  
    const [showFileForm, setShowFileForm] = useState(false);
    const [fileTypeInputValue, setFileTypeInputValue] = useState("cpp");
    const [showFolderForm, setShowFolderForm] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [isContentSaved, setIsContentSaved] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null); 
    const [editedContent, setEditedContent] = useState("");
    const [currentFolder, setCurrentFolder] = useState("ide"); // Default folder is "ide"

    const handleFileSubmit = async (event) => {
        event.preventDefault();

        const parentId = openFile ? (openFile.droppable ? openFile.id : openFile.parent) : 0;
        const newFile = { 
            id: treeData[treeData.length - 1] ? treeData[treeData.length - 1].id + 1 : 1, 
            parent: parentId, 
            text: inputValue, 
            data: { language: fileTypeInputValue } 
        };
    
        dispatch({ type: 'ADD_FILE_TAB', payload: { id: treeData[treeData.length - 1] ? treeData[treeData.length - 1].id + 1 : 1, language: fileTypeInputValue, name: inputValue, code: "" } });

        dispatch({ type: 'UPDATE_FILE_CODE', key: treeData[treeData.length - 1] ? treeData[treeData.length - 1].id + 1 : 1, value: "" });

        dispatch({ type: 'UPDATE_IS_FILE_SAVED', key: treeData[treeData.length - 1] ? treeData[treeData.length - 1].id + 1 : 1, payload: true });

        const newTreeData = [...treeData, newFile];
        dispatch({ type: 'SET_TREE_DATA', payload: newTreeData });
        setTreeData(newTreeData);

        setOpenFile(newFile);
    };
    
    const handleFolderSubmit = async (event) => {
        event.preventDefault();

        const parentId = openFile ? (openFile.droppable ? openFile.id : openFile.parent) : 0;
        const newFile = { 
            id: treeData[treeData.length - 1].id + 1, 
            parent: parentId, 
            text: inputValue, 
            droppable: true
        };
    
        const newTreeData = [...treeData, newFile];
        setTreeData(newTreeData);    
    };


    useEffect(() => {
    }, [activeTabIndex]);
    
    useEffect(() => {
    }, [fileTabs]);
    
     const handleItemClick = async (itemName) => {
        try {
            const uid = auth.currentUser.uid;
            const ideRef = doc(db, "IDE", uid);
            const ideSnapshot = await getDoc(ideRef);
            setReadCount(prevReadCount => prevReadCount + 1);

            if (ideSnapshot.exists()) {
                const itemData = ideSnapshot.data().ide[itemName];
                const itemType = ideSnapshot.data().fileTypes[itemName];
                setSelectedItem(itemName);
                setEditedContent(itemData); // Set the edited content to the selected item data
                setCode(itemData);

                // Check if file with same name already exists
                const existingTabIndex = fileTabs.findIndex(tab => tab.name === itemName);
                if (existingTabIndex !== -1) {
                    // If file exists, set the active tab index to that file
                    dispatch({ type: 'SET_ACTIVE_FILE_TAB', payload: existingTabIndex });
                } else {
                    // If file doesn't exist, create a new file and set it as the active tab
                    dispatch({ type: 'ADD_FILE_TAB', payload: { language: itemType, name: itemName, code: itemData } });
                    dispatch({ type: 'SET_ACTIVE_FILE_TAB', payload: fileTabs.length });
                }
            } else {
            }
        } catch (error) {
        }
    };


    const handleSave = async () => {
        try {
            const uid = auth.currentUser.uid;
            const ideRef = doc(db, "IDE", uid);
            const ideSnapshot = await getDoc(ideRef);
            if (ideSnapshot.exists()) {
                const existingIdeMap = ideSnapshot.data().ide || {};
                const updatedIdeMap = {
                    ...existingIdeMap,
                    [fileTabs[activeTabIndex].name]: code // Update the content of the selected item
                };
                await setDoc(ideRef, { ide: updatedIdeMap }, { merge: true });
                setIsContentSaved(true);

                const updateFileCode = async (newFileCode) => {
                
                  try {
                    await setDoc(ideRef, { code: newFileCode }, { merge: true });
                  } catch (error) {
                  }
                }; 
            
                updateFileCode(fileCode);

                dispatch({ type: 'UPDATE_IS_FILE_SAVED', payload: true });
            } else {
            }
        } catch (error) {
        }
    };

  const [treeData, setTreeData] = useState(initialData);
  const fileCode = useSelector(state => state.fileCode);

  useEffect(() => {
  }, [fileCode]);

  const handleDrop = async (newTreeData) => {
    setTreeData(newTreeData);
  }; 

  const loadedTreeData = useSelector(state => state.loadedTreeData);

  useEffect(() => {
    const updateTree = async (newTreeData) => {
      if (auth.currentUser && auth.currentUser.uid) {
        const uid = auth.currentUser.uid;
      
        const docRef = doc(db, "IDE", uid);
        
        try {
            await setDoc(docRef, { files: newTreeData }, { merge: true });
        } catch (error) {
        }
      }
    }; 

    if (loadedTreeData) updateTree(treeData);
  }, [treeData]);
  
  const loadedFirestoreCode = useSelector(state => state.loadedFirestoreCode);

  useEffect(() => {
    const fetchData = async (userId) => {
      const docRef = doc(db, "IDE", userId);
      const docSnap = await getDoc(docRef);
      setReadCount(prevReadCount => prevReadCount + 1);
  
      if (docSnap.exists()) {
        const data = docSnap.data();

        setTreeData(data.files || initialData);

        if (data.code) {
          dispatch({type: 'REPLACE_FILE_CODE', newState: data.code});

          const initialSaveStates = {};
          for (let key in data.code) {
            initialSaveStates[key] = true;
          }

          dispatch({ type: 'REPLACE_IS_FILE_SAVED', payload: initialSaveStates });
        } else {
          console.log("data.code is undefined, retrying...");
          fetchData(userId);
        }  
      } else {
        setTreeData(initialData);

        dispatch({type: 'REPLACE_FILE_CODE', newState: docSnap.data().code || initialCode});
      }
    };  

    if (auth.currentUser && auth.currentUser.uid && !loadedFirestoreCode) {
      fetchData(auth.currentUser.uid);
      dispatch({ type: 'LOADED_FIRESTORE_CODE' });
      dispatch({ type: 'LOADED_TREE_DATA' });
    }
  }, [auth.currentUser]);

  const [openFile, setOpenFile] = useState(null);

  useEffect(() => {
    const handleFileClick = async () => {
      setSelectedItem(openFile.text);
      setEditedContent(fileCode[openFile.id]);
      setCode(fileCode[openFile.id]);

      // Check if file with same name already exists
      const existingTabIndex = fileTabs.findIndex(tab => tab.id === openFile.id);
      if (existingTabIndex !== -1) {
          // If file exists, set the active tab index to that file
          dispatch({ type: 'SET_ACTIVE_FILE_TAB', payload: existingTabIndex });
      } else {
          // If file doesn't exist, create a new file and set it as the active tab
          dispatch({ type: 'ADD_FILE_TAB', payload: { id: openFile.id, language: openFile.data.language, name: openFile.text, code: fileCode[openFile.id] } });
          dispatch({ type: 'SET_ACTIVE_FILE_TAB', payload: fileTabs.length });
      }
    };

    if (openFile && !openFile.droppable) {
      handleFileClick();
    }
  }, [openFile]);

  const handleFileDelete = (openFile) => {
    if (openFile && openFile.id) {

      if (openFile.droppable) {
        for (let file of treeData) {
          if (file.parent === openFile.id) {
            handleFileDelete(file);
          }
        }
        setTreeData(prevArray => prevArray.filter(object => object.id !== openFile.id));
        return;
      }
      
      const id = openFile.id;
      const removeIndex = fileTabs.findIndex(object => object.id === id);
      dispatch({ type: 'REMOVE_FILE_TAB_BY_ID', payload: id });
      setTreeData(prevArray => prevArray.filter(object => object.id !== id));
      deleteFirestoreCode(id, fileCode);
      dispatch({ type: 'DELETE_FILE_CODE', key: id });
      dispatch({ type: 'DELETE_IS_FILE_SAVED', key: id });

      if (fileTabs.length > 1) {

        if (activeTabIndex === fileTabs.length - 1) {
          setCode(fileTabs[activeTabIndex - 1].code);
          dispatch({ type: 'SET_ACTIVE_FILE_TAB', payload: activeTabIndex - 1 });
          return;
        } else if (removeIndex < activeTabIndex) {
          setCode(fileTabs[activeTabIndex - 1].code);
          dispatch({ type: 'SET_ACTIVE_FILE_TAB', payload: activeTabIndex - 1 });
          return;
        }
        setCode(fileTabs[activeTabIndex].code);
        dispatch({ type: 'SET_ACTIVE_FILE_TAB', payload: activeTabIndex });
        return;
      } else {
        setCode(null);
        dispatch({ type: 'SET_ACTIVE_FILE_TAB', payload: 0 });
        return;
      }
    }
  }

  const deleteFirestoreCode = async (key, fileCode) => {
    try {
      const uid = auth.currentUser.uid;
      const ideRef = doc(db, "IDE", uid);

      const {[key]: _, ...newFileCode} = fileCode;
      await setDoc(ideRef, { code: newFileCode }, { merge: true });
    } catch (error) {
      console.log("Error deleting firestore filecode", error)
    }
  }

  useEffect(() => {
    if (loadedTreeData) dispatch({ type: 'SET_TREE_DATA', payload: treeData });
  }, [treeData]);
  
  useEffect(() => {
    dispatch({ type: 'SET_OPEN_FILE', payload: openFile });
  }, [openFile]);

  const [hoveredFile, setHoveredFile] = useState(null);
  const openTemplate = useSelector(state => state.openTemplate);
  const templateIsClicked = useSelector(state => state.templateIsClicked);
  const filesSectionOpen = useSelector(state => state.filesSectionOpen);
  const templatesSectionOpen = useSelector(state => state.templatesSectionOpen);

  const isFileSaved = useSelector(state => state.isFileSaved);

  return (
    <div style={{ minWidth: '240px', backgroundColor: 'var(--site-bg)', borderRight: '1px solid var(--border)' }}>
        <div style={{ height: "49px", alignItems: "center", display: "flex", direction: "row", borderBottom: '1px solid var(--border)' }}>
            <ChevronRightIcon 
                style={{ marginLeft: '10px', height: "30px", width: "30px" }}
                onClick={() => { dispatch({ type: 'SET_IS_FILE_LIST_OPEN', payload: false }); }}    
            />
        </div>
        <div style={{ marginTop: '4px' , paddingLeft: '2px' }} className={`${styles.selectedBackground} ${styles.fileNameButtonRow} ${styles.vertCenterIcons}`}>
            <span className={styles.vertCenterIcons} onClick={() => dispatch({ type: 'TOGGLE_FILES_SECTION_OPEN' })}>{filesSectionOpen ? <ExpandMoreIcon /> : <ChevronRightIcon />}</span>
            <p className={`${styles.marginSpacing} ${styles.classTwo}`} style={{ color: 'var(--dim-text)' }}>
              <Text fw={700} size="lg">
                FILES
              </Text>
            </p>
            <div className={`${styles.rightAlign} ${styles.vertCenterIcons}`}>
              <ActionIcon variant="subtle"> 
                <NoteAddOutlinedIcon style={{ color: 'var(--dim-text)' }} onClick={() => setShowFileForm(!showFileForm)}/>
              </ActionIcon>
              <ActionIcon variant="subtle">
                <CreateNewFolderOutlinedIcon style={{ color: 'var(--dim-text)' }} onClick={() => setShowFolderForm(!showFolderForm)}/>
              </ActionIcon>
              <ActionIcon variant="subtle">
                <IconTrash style={{ color: 'var(--dim-text)' }} onClick={() => handleFileDelete(openFile)}/>
              </ActionIcon>
            </div>
        </div>
            <div className={styles.marginSpacing}>
            </div>
        { filesSectionOpen &&
          <DndProvider backend={MultiBackend} options={getBackendOptions()} style={{ height: "100%" }}>
            <Tree
              tree={treeData}
              rootId={0}
              onDrop={handleDrop}
              render={(node, { depth, isOpen, onToggle }) => (
                <div 
                  style={{ backgroundColor: openFile && openFile.text === node.text ? 'var(--selected-item)' : hoveredFile === node ? 'var(--hover)' : 'transparent' }}
                  onClick={() => {setOpenFile(node);}}
                  onMouseEnter={() => {
                    setHoveredFile(node);
                  }}
                  onMouseLeave={() => {
                    setHoveredFile(null); 
                  }}
                >
                  <div style={{ marginLeft: (depth + 1) * 20 + 2, color: (hoveredFile === node) || (openFile && openFile.text === node.text) ? 'white' : 'var(--dim-text)' }} className={styles.vertCenterIcons}>
                    {node.droppable && (
                      <span className={styles.vertCenterIcons} onClick={onToggle}>{isOpen ? <ExpandMoreIcon /> : <ChevronRightIcon />}</span>
                    )}
                    <img src={node.data && node.data.language ? LANGUAGE_ICON[node.data.language] : ''} className={styles.languageIcon}/>
                    {`${node.text}${node.data && node.data.language ? FILE_EXTENSION[node.data.language] : ''}`}
                  </div>
                </div>
              )}
              dragPreviewRender={(monitorProps) => (
                <div>{monitorProps.item.text}</div>
              )}
              style={{ height: "100%" }}
            />
          </DndProvider> 
        }
        {showFileForm && (
          <Container>
            <form onSubmit={handleFileSubmit} style={{ margin: '10px 0' }}>
                <Select 
                  label="Language" 
                  data={['cpp', 'python', 'java']}
                  value={fileTypeInputValue}
                  onChange={(_value, option) => setFileTypeInputValue(_value)}
                  styles={{ 
                    input: { backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)'}, 
                    dropdown: { backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)'} 
                  }}
                  allowDeselect={false}
                />
                <TextInput
                    label="File name"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.currentTarget.value)}
                    autoFocus
                    styles={{ 
                      input: { backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)'}, 
                    }}  
                    placeholder="File Name"
                    rightSection={<ActionIcon variant="light" type="submit" radius="xl"><IconPlus /></ActionIcon>}
                />
            </form>
          </Container>
      )}
      {showFolderForm && (
        <Container>
          <form onSubmit={handleFolderSubmit}>
              <TextInput
                  label="Folder name"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.currentTarget.value)}
                  autoFocus
                  styles={{ 
                    input: { backgroundColor: 'var(--code-bg)', border: '1px solid var(--border)'}, 
                  }}  
                  placeholder="Folder Name"
                  rightSection={<ActionIcon variant="light" type="submit" radius="xl"><IconPlus /></ActionIcon>}
              />
          </form>
        </Container>
      )}   
        <div style={{ marginTop: '4px', paddingLeft: '2px' }} className={`${styles.selectedBackground} ${styles.fileNameButtonRow} ${styles.vertCenterIcons}`}>
            <span className={styles.vertCenterIcons} onClick={() => dispatch({ type: 'TOGGLE_TEMPLATES_SECTION_OPEN' })}>{templatesSectionOpen ? <ExpandMoreIcon /> : <ChevronRightIcon />}</span>
            <p className={`${styles.marginSpacing} ${styles.classTwo}`} style={{ color: 'var(--dim-text)' }}>
              <Text fw={700} size="lg">
                CODE TEMPLATES
              </Text>
            </p>
            <div className={`${styles.rightAlign} ${styles.vertCenterIcons}`}>
            </div>
        </div>
        { templatesSectionOpen &&
          <DndProvider backend={MultiBackend} options={getBackendOptions()} style={{ height: "100%" }}>
            <Tree
              tree={TEMPLATES}
              rootId={0}
              render={(node, { depth, isOpen, onToggle }) => (
                <div 
                  style={{ 
                    marginLeft: (depth + 1) * 20 + 2,
                    backgroundColor: openFile && openFile.text === node.text ? 'var(--selected-item)' : hoveredFile === node ? 'var(--hover)' : 'transparent',
                    color: (hoveredFile === node) || (openFile && openFile.text === node.text) ? 'white' : 'var(--dim-text)'
                  }}
                  onClick={() => {
                    setHoveredFile(node); 
                    if (!node.droppable)
                    dispatch({ type: 'SET_OPEN_TEMPLATE', payload: { name: node.text, language: node.data.language }})
                  }}
                  onMouseEnter={() => {
}}
                  onMouseLeave={() => {
}}          
                  className={styles.vertCenterIcons}
                >
                  {node.droppable && (
                    <span className={styles.vertCenterIcons} onClick={onToggle}>{isOpen ? <ExpandMoreIcon />: <ChevronRightIcon />}</span>
                  )}
                  <img src={node.data && node.data.language ? LANGUAGE_ICON[node.data.language] : ''} className={styles.languageIcon}/>
                  {`${node.text}${node.data && node.data.language ? FILE_EXTENSION[node.data.language] : ''}`}
                  {!node.droppable && (
                    <CopyButton value={node.data && node.data.language ? TEMPLATE_CODE[node.text][node.data.language] : ''} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="right">
                        <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                          {copied ? (
                            <IconCheck style={{ width: rem(18) }} />
                          ) : (
                            <IconCopy style={{ width: rem(18) }} />
                          )}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                  )}
                </div>
              )}
              dragPreviewRender={(monitorProps) => (
                <div>{monitorProps.item.text}</div>
              )}
              style={{ height: "100%" }}
            />
          </DndProvider>
        }
    </div>
  );
};

export default FileList;
