import React from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

interface ImageSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  filterTag: string;
  onFilterChange: (value: string) => void;
  availableTags: string[];
}

export default function ImageSearch({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  filterTag,
  onFilterChange,
  availableTags,
}: ImageSearchProps) {
  const handleSortChange = (event: SelectChangeEvent) => {
    onSortChange(event.target.value);
  };

  const handleFilterChange = (event: SelectChangeEvent) => {
    onFilterChange(event.target.value);
  };

  return (
    <Box className="flex flex-col md:flex-row gap-4 mb-6 w-full">
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
          <MenuItem value="">
            <em>Sort by...</em>
          </MenuItem>
          <MenuItem value="name">Name</MenuItem>
          <MenuItem value="date">Date</MenuItem>
          <MenuItem value="size">Size</MenuItem>
        </Select>
      </FormControl>

      <FormControl className="min-w-[200px]">
        <Select
          value={filterTag}
          onChange={handleFilterChange}
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
          <MenuItem value="">
            <em>Filter by tag...</em>
          </MenuItem>
          {availableTags.map((tag) => (
            <MenuItem key={tag} value={tag}>
              {tag}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
