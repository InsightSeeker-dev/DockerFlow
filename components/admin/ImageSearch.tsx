import React from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

interface ImageSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}

export default function ImageSearch({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
}: ImageSearchProps) {
  const handleSortChange = (event: any) => {
    onSortChange(event.target.value);
  };

  return (
    <Box className="flex gap-4 w-full">
      <TextField
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search images..."
        className="flex-1"
        variant="outlined"
        size="medium"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon className="text-gray-400 w-6 h-6" />
            </InputAdornment>
          ),
          className: "bg-white/5 backdrop-blur-sm border-2 border-gray-700 hover:border-gray-600 focus-within:border-blue-500 rounded-lg shadow-lg h-12",
          sx: {
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none'
            },
            '& input': {
              color: 'white',
              fontSize: '1.1rem',
              padding: '0.875rem 1rem',
              '&::placeholder': {
                color: 'rgb(156 163 175)',
                opacity: 1
              }
            }
          }
        }}
      />

      <FormControl className="min-w-[200px]">
        <Select
          value={sortBy}
          onChange={handleSortChange}
          displayEmpty
          className="h-12 bg-white/5 backdrop-blur-sm border-2 border-gray-700 hover:border-gray-600 focus:border-blue-500 rounded-lg shadow-lg"
          sx={{
            color: 'white',
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none'
            },
            '& .MuiSelect-icon': {
              color: 'rgb(156 163 175)'
            },
            '& .MuiSelect-select': {
              padding: '0.875rem 1rem'
            }
          }}
        >
          <MenuItem value="newest">Newest First</MenuItem>
          <MenuItem value="oldest">Oldest First</MenuItem>
          <MenuItem value="name">Name</MenuItem>
          <MenuItem value="size">Size</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}
