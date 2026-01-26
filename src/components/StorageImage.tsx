import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface StorageImageProps {
  bucket: 'logos' | 'illustrations';
  path: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

const StorageImage = ({ bucket, path, alt, className, fallback }: StorageImageProps) => {
  const [error, setError] = useState(false);

  const { data: imageUrl, isLoading } = useQuery({
    queryKey: ['storage-image', bucket, path],
    queryFn: async () => {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    },
  });

  if (isLoading) {
    return (
      <div className={`${className} animate-pulse bg-muted rounded-lg`} />
    );
  }

  if (error || !imageUrl) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img 
      src={imageUrl} 
      alt={alt} 
      className={className}
      onError={() => setError(true)}
    />
  );
};

export default StorageImage;
