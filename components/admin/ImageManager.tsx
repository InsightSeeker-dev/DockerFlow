import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Dialog,
  Grid,
  Chip,
  Tooltip,
  LinearProgress,
  ThemeProvider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import ImagePuller from './ImagePuller';
import DockerfileBuilder from './DockerfileBuilder';
import DockerfileBuildFromFile from './DockerfileBuildFromFile';
import ImageSearch from './ImageSearch';
import { theme } from '@/lib/theme';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`image-tabpanel-${index}`}
      aria-labelledby={`image-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface DockerImage {
  Id: string;
  RepoTags: string[];
  Size: number;
  Created: number;
}

export default function ImageManager() {
  const [tabValue, setTabValue] = useState(0);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<DockerImage | null>(null);
  const [showImageInfo, setShowImageInfo] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filterTag, setFilterTag] = useState('');

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatSize = (size: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let formattedSize = size;
    let unitIndex = 0;
    while (formattedSize >= 1024 && unitIndex < units.length - 1) {
      formattedSize /= 1024;
      unitIndex++;
    }
    return `${formattedSize.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const fetchImages = async () => {
    try {
      const response = await fetch('/api/admin/images/list');
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      setImages(data);
      filterAndSortImages(data, searchTerm, sortBy, filterTag);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Failed to fetch images');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortImages = (
    imageList: DockerImage[],
    search: string,
    sort: string,
    tag: string
  ) => {
    let filtered = [...imageList];

    if (search) {
      filtered = filtered.filter((image) =>
        image.RepoTags?.some((tag) =>
          tag.toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    if (tag) {
      filtered = filtered.filter((image) =>
        image.RepoTags?.some((t) => t === tag)
      );
    }

    filtered.sort((a, b) => {
      switch (sort) {
        case 'newest':
          return b.Created - a.Created;
        case 'oldest':
          return a.Created - b.Created;
        case 'name':
          return (a.RepoTags?.[0] || '').localeCompare(b.RepoTags?.[0] || '');
        case 'size':
          return b.Size - a.Size;
        default:
          return 0;
      }
    });

    setFilteredImages(filtered);
  };

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      const response = await fetch('/api/admin/images/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId }),
      });

      if (!response.ok) throw new Error('Failed to delete image');
      
      toast.success('Image deleted successfully');
      handleRefresh();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const getAvailableTags = () => {
    const tags = new Set<string>();
    images.forEach((image) => {
      image.RepoTags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  };

  useEffect(() => {
    fetchImages();
  }, [refreshKey]);

  useEffect(() => {
    filterAndSortImages(images, searchTerm, sortBy, filterTag);
  }, [searchTerm, sortBy, filterTag, images]);

  return (
    <ThemeProvider theme={theme}>
      <Paper className="p-4">
        <Box className="flex justify-between items-center mb-4">
          <Typography variant="h6" className="text-gray-800">Docker Images</Typography>
          <IconButton 
            onClick={handleRefresh} 
            disabled={loading}
            className="text-sky-500 hover:text-sky-600"
          >
            <RefreshIcon />
          </IconButton>
        </Box>

        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          className="border-b border-gray-200"
        >
          <Tab label="Images" />
          <Tab label="Pull Image" />
          <Tab label="Build Image" />
          <Tab label="Build from File" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <LinearProgress />
          ) : (
            <>
              <ImageSearch
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                sortBy={sortBy}
                onSortChange={setSortBy}
                filterTag={filterTag}
                onFilterChange={setFilterTag}
                availableTags={getAvailableTags()}
              />

              <Grid container spacing={2}>
                {filteredImages.map((image) => (
                  <Grid item xs={12} md={6} lg={4} key={image.Id}>
                    <Card className="hover:shadow-md transition-shadow duration-200">
                      <CardContent>
                        <Typography variant="h6" className="mb-2 font-mono text-gray-800">
                          {image.RepoTags?.[0] || 'Untitled'}
                        </Typography>
                        <Box className="space-y-2">
                          <Typography variant="body2" className="text-gray-600">
                            ID: {image.Id.substring(7, 19)}
                          </Typography>
                          <Typography variant="body2" className="text-gray-600">
                            Size: {formatSize(image.Size)}
                          </Typography>
                          <Typography variant="body2" className="text-gray-600">
                            Created: {formatDate(image.Created)}
                          </Typography>
                          <Box className="mt-2">
                            {image.RepoTags?.map((tag) => (
                              <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                className="mr-1 mb-1 bg-sky-100 text-sky-700"
                              />
                            ))}
                          </Box>
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Tooltip title="Image Info">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedImage(image);
                              setShowImageInfo(true);
                            }}
                            className="text-gray-600 hover:text-sky-500"
                          >
                            <InfoIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Image">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteImage(image.Id)}
                            className="text-gray-600 hover:text-red-500"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ImagePuller onImagePulled={handleRefresh} />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <DockerfileBuilder onImageBuilt={handleRefresh} />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <DockerfileBuildFromFile onImageBuilt={handleRefresh} />
        </TabPanel>
      </Paper>

      <Dialog
        open={showImageInfo}
        onClose={() => setShowImageInfo(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedImage && (
          <Box className="p-4">
            <Typography variant="h6" className="mb-4 text-gray-800">
              Image Details
            </Typography>
            <pre className="bg-gray-50 p-4 rounded overflow-auto text-gray-700">
              {JSON.stringify(selectedImage, null, 2)}
            </pre>
            <Box className="mt-4 flex justify-end">
              <Button 
                onClick={() => setShowImageInfo(false)}
                className="text-sky-500 hover:text-sky-600"
              >
                Close
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>
    </ThemeProvider>
  );
}
