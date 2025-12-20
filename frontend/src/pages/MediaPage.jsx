import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Image, Upload, Trash2, RefreshCw, ChevronLeft, ChevronRight, Calendar, FileImage } from 'lucide-react';
import { api } from '@/store';

export default function MediaPage() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [imageCache, setImageCache] = useState({});
  const limit = 12;

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/images/paginated?page=${page}&limit=${limit}`);
      setImages(response.data.images);
      setTotalPages(response.data.total_pages);
      setTotal(response.data.total);
      
      // Load image previews
      response.data.images.forEach(img => {
        loadImagePreview(img.id);
      });
    } catch (error) {
      toast.error('Erro ao carregar imagens');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const loadImagePreview = async (imageId) => {
    if (imageCache[imageId]) return;
    
    try {
      const response = await api.get(`/images/${imageId}/file`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      setImageCache(prev => ({ ...prev, [imageId]: blobUrl }));
    } catch (error) {
      console.error('Error loading image:', error);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Imagem enviada!');
      
      // Load preview for new image
      loadImagePreview(response.data.id);
      
      // Refresh list
      fetchImages();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
    }
  };

  const handleReplace = async (e, imageId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionLoading(imageId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.put(`/images/${imageId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Imagem substituída!');
      
      // Clear old cache and reload
      setImageCache(prev => {
        const newCache = { ...prev };
        delete newCache[imageId];
        return newCache;
      });
      loadImagePreview(imageId);
      
      fetchImages();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao substituir imagem');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedImage) return;

    setActionLoading(selectedImage.id);
    try {
      await api.delete(`/images/${selectedImage.id}`);
      toast.success('Imagem deletada!');
      setDeleteDialogOpen(false);
      setSelectedImage(null);
      
      // Clear cache
      setImageCache(prev => {
        const newCache = { ...prev };
        delete newCache[selectedImage.id];
        return newCache;
      });
      
      fetchImages();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao deletar imagem');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div data-testid="media-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Mídias</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} imagens no total</p>
        </div>
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow" disabled={uploading}>
            {uploading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Enviar Imagem
          </Button>
        </div>
      </div>

      {/* Images Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : images.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <FileImage className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">Nenhuma imagem</h3>
            <p className="text-muted-foreground text-sm mb-4">Envie sua primeira imagem</p>
            <div className="relative inline-block">
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              <Button className="bg-primary text-primary-foreground">
                <Upload className="w-4 h-4 mr-2" />
                Enviar Imagem
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {images.map((image, index) => (
            <Card
              key={image.id}
              className={`glass-card overflow-hidden group animate-fade-in stagger-${(index % 5) + 1}`}
            >
              <div className="aspect-square relative bg-muted/20">
                {imageCache[image.id] ? (
                  <img
                    src={imageCache[image.id]}
                    alt={image.original_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {/* Replace */}
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleReplace(e, image.id)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={actionLoading === image.id}
                    />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9"
                      disabled={actionLoading === image.id}
                    >
                      {actionLoading === image.id ? (
                        <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  
                  {/* Delete */}
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-9 w-9"
                    onClick={() => {
                      setSelectedImage(image);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <CardContent className="p-2">
                <p className="text-xs text-foreground truncate" title={image.original_name}>
                  {image.original_name}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3" />
                  {formatDate(image.created_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-border"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border-border"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-border mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deletar Imagem</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar "{selectedImage?.original_name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
