import React, { useState } from 'react';
import { Box, Paper, Typography, IconButton, Button } from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import Editor from '@monaco-editor/react';

interface File {
  name: string;
  content: string;
}

interface FileEditorProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export default function FileEditor({ files, onFilesChange }: FileEditorProps) {
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const handleFileChange = (content: string | undefined) => {
    if (content === undefined) return;
    const newFiles = [...files];
    newFiles[activeFileIndex].content = content;
    onFilesChange(newFiles);
  };

  const addNewFile = () => {
    const newFileName = `file${files.length + 1}`;
    onFilesChange([...files, { name: newFileName, content: '' }]);
    setActiveFileIndex(files.length);
  };

  const deleteFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
    if (activeFileIndex >= newFiles.length) {
      setActiveFileIndex(Math.max(0, newFiles.length - 1));
    }
  };

  const renameFile = (index: number, newName: string) => {
    const newFiles = [...files];
    newFiles[index].name = newName;
    onFilesChange(newFiles);
  };

  return (
    <Box className="flex flex-col h-[500px] bg-gray-50 rounded-lg overflow-hidden">
      <Box className="flex items-center gap-2 p-2 bg-gray-100 border-b border-gray-200">
        {files.map((file, index) => (
          <Box
            key={index}
            className={`flex items-center gap-1 px-3 py-1 rounded-md cursor-pointer ${
              activeFileIndex === index
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setActiveFileIndex(index)}
          >
            <input
              type="text"
              value={file.name}
              onChange={(e) => renameFile(index, e.target.value)}
              className={`w-24 bg-transparent border-none outline-none ${
                activeFileIndex === index ? 'text-white' : 'text-gray-700'
              }`}
              onClick={(e) => e.stopPropagation()}
            />
            {files.length > 1 && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFile(index);
                }}
                className={activeFileIndex === index ? 'text-white' : 'text-gray-500'}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={addNewFile}
          size="small"
          variant="outlined"
          className="ml-2"
        >
          Add File
        </Button>
      </Box>
      <Box className="flex-1">
        <Editor
          height="100%"
          language="dockerfile"
          theme="vs-dark"
          value={files[activeFileIndex]?.content}
          onChange={handleFileChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
          }}
        />
      </Box>
    </Box>
  );
}
