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
    <Box className="flex flex-col md:flex-row gap-4 mb-4">
      <TextField
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search images..."
        className="flex-1"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
      
      <FormControl className="min-w-[200px]">
        <InputLabel>Sort By</InputLabel>
        <Select value={sortBy} label="Sort By" onChange={handleSortChange}>
          <MenuItem value="newest">Newest First</MenuItem>
          <MenuItem value="oldest">Oldest First</MenuItem>
          <MenuItem value="name">Name</MenuItem>
          <MenuItem value="size">Size</MenuItem>
        </Select>
      </FormControl>

      <FormControl className="min-w-[200px]">
        <InputLabel>Filter Tag</InputLabel>
        <Select value={filterTag} label="Filter Tag" onChange={handleFilterChange}>
          <MenuItem value="">All Tags</MenuItem>
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
