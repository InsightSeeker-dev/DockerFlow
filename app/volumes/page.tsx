import { VolumeList } from '../../components/volumes/volume-list';

export default function VolumesPage() {
  const handleStatsUpdate = (stats: {
    totalVolumes: number;
    totalSize: number;
    activeVolumes: number;
    unusedVolumes: number;
  }) => {
    console.log('Volume stats updated:', stats);
  };

  return <VolumeList onStatsUpdate={handleStatsUpdate} />;
}