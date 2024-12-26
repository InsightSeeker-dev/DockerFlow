import React from 'react';
import { Box, Paper, Typography, Grid } from '@mui/material';
import {
  Storage as StorageIcon,
  CloudDownload as PullIcon,
  Tag as TagIcon,
  Image as ImageIcon,
} from '@mui/icons-material';

interface ImageStatsProps {
  totalImages: number;
  totalSize: number;
  totalPulls: number;
  totalTags: number;
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export default function ImageStats({ totalImages, totalSize, totalPulls, totalTags }: ImageStatsProps) {
  const stats = [
    {
      title: 'Total Images',
      value: totalImages,
      icon: ImageIcon,
      color: '#2563eb', // blue-600
    },
    {
      title: 'Total Size',
      value: formatSize(totalSize),
      icon: StorageIcon,
      color: '#16a34a', // green-600
    },
    {
      title: 'Total Pulls',
      value: totalPulls,
      icon: PullIcon,
      color: '#9333ea', // purple-600
    },
    {
      title: 'Total Tags',
      value: totalTags,
      icon: TagIcon,
      color: '#dc2626', // red-600
    },
  ];

  return (
    <Grid container spacing={3}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Grid item xs={12} sm={6} md={3} key={stat.title}>
            <Paper
              sx={{
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  p: 2,
                  opacity: 0.1,
                }}
              >
                <Icon
                  sx={{
                    fontSize: '4rem',
                    color: stat.color,
                  }}
                />
              </Box>
              <Typography
                variant="h4"
                component="div"
                sx={{
                  color: stat.color,
                  fontWeight: 'bold',
                  mb: 1,
                }}
              >
                {stat.value}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontWeight: 500 }}
              >
                {stat.title}
              </Typography>
            </Paper>
          </Grid>
        )
      })}
    </Grid>
  );
}
