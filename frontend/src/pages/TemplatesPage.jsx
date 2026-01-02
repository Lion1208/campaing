import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, FileText, Edit2, Trash2, Image, Upload, Filter } from 'lucide-react';
import { api } from '@/store';

export default function TemplatesPage() {
  const { user } = useAuthStore();
  const [templates, setTemplates] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({ name: '', message: '', image_id: 'none' });
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('mine');

  const isAdmin = user?.role === 'admin';

  const fetchTemplates = async () => {
    try {
      const response = await api.get(`/templates?owner_filter=${ownerFilter}`);
      setTemplates(response.data);
    } catch (error) {
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    try {
      const response = await api.get('/images');
      setImages(response.data);
    } catch (error) {
      console.error('Erro ao carregar imagens');
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchImages();
  }, [ownerFilter]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImages([...images, response.data]);
      setFormData(prev => ({ ...prev, image_id: response.data.id }));
      toast.success('Imagem enviada!');
    } catch (error) {
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.message.trim()) {
      toast.error('Preencha nome e mensagem');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        message: formData.message.trim(),
        image_id: formData.image_id === 'none' ? null : formData.image_id
      };
      const response = await api.post('/templates', payload);
      setTemplates([response.data, ...templates]);
      toast.success('Template criado!');
      setCreateDialogOpen(false);
      setFormData({ name: '', message: '', image_id: 'none' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar template');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTemplate || !formData.name.trim() || !formData.message.trim()) {
      toast.error('Preencha nome e mensagem');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        message: formData.message.trim(),
        image_id: formData.image_id === 'none' ? null : formData.image_id
      };
      const response = await api.put(`/templates/${selectedTemplate.id}`, payload);
      setTemplates(templates.map(t => t.id === selectedTemplate.id ? response.data : t));
      toast.success('Template atualizado!');
      setEditDialogOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar template');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    setActionLoading(true);
    try {
      await api.delete(`/templates/${selectedTemplate.id}`);
      setTemplates(templates.filter(t => t.id !== selectedTemplate.id));
      toast.success('Template deletado!');
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao deletar template');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditDialog = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      message: template.message,
      image_id: template.image_id || 'none'
    });
    setEditDialogOpen(true);
  };

  return (
    <div data-testid="templates-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Templates</h1>
          <p className="text-muted-foreground text-sm mt-1">Mensagens pré-prontas para suas campanhas</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Admin Filter */}
          {isAdmin && (
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[180px] bg-muted/50 border-border">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos do Sistema</SelectItem>
                <SelectItem value="mine">Apenas Meus</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow">
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            </DialogTrigger>
          <DialogContent className="glass-card border-border mx-4 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Novo Template</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Crie uma mensagem pré-pronta para usar em campanhas
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-foreground">Nome do Template</Label>
                <Input
                  placeholder="Ex: Promoção Black Friday"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-muted/50 border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Mensagem</Label>
                <Textarea
                  placeholder="Digite a mensagem do template..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="min-h-24 bg-muted/50 border-border text-foreground resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Imagem (opcional)</Label>
                <div className="flex gap-2">
                  <Select value={formData.image_id} onValueChange={(v) => setFormData({ ...formData, image_id: v })}>
                    <SelectTrigger className="bg-muted/50 border-border text-foreground flex-1">
                      <SelectValue placeholder="Sem imagem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem imagem</SelectItem>
                      {images.map((img) => (
                        <SelectItem key={img.id} value={img.id}>
                          {img.original_name || img.filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={uploadingImage}
                    />
                    <Button type="button" variant="outline" disabled={uploadingImage} className="border-border">
                      {uploadingImage ? (
                        <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={actionLoading}
                className="w-full bg-primary text-primary-foreground"
              >
                {actionLoading ? 'Criando...' : 'Criar Template'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">Nenhum template</h3>
            <p className="text-muted-foreground text-sm mb-4">Crie seu primeiro template de mensagem</p>
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary text-primary-foreground">
              Criar Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template, index) => (
            <Card
              key={template.id}
              className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1}`}
            >
              <CardContent className="p-4">
                {/* Image Preview */}
                {template.image_url && (
                  <div className="h-24 -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-xl">
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}${template.image_url}`}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <h3 className="font-semibold text-foreground truncate">{template.name}</h3>
                  </div>
                  {template.image_url && (
                    <Badge variant="outline" className="status-connected text-[10px] flex-shrink-0">
                      <Image className="w-3 h-3 mr-1" />
                      Imagem
                    </Badge>
                  )}
                </div>

                {/* Owner badge for admin viewing all */}
                {isAdmin && ownerFilter === 'all' && template.owner_username && (
                  <Badge variant="outline" className="w-fit text-[10px] mb-2 bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {template.owner_username}
                  </Badge>
                )}
                
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4 min-h-[3.5rem]">
                  {template.message}
                </p>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => openEditDialog(template)}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-border"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedTemplate(template);
                      setDeleteDialogOpen(true);
                    }}
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="glass-card border-border mx-4 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Template</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Atualize o template selecionado
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-foreground">Nome do Template</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-muted/50 border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Mensagem</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="min-h-24 bg-muted/50 border-border text-foreground resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Imagem (opcional)</Label>
              <Select value={formData.image_id} onValueChange={(v) => setFormData({ ...formData, image_id: v })}>
                <SelectTrigger className="bg-muted/50 border-border text-foreground">
                  <SelectValue placeholder="Sem imagem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem imagem</SelectItem>
                  {images.map((img) => (
                    <SelectItem key={img.id} value={img.id}>
                      {img.original_name || img.filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleUpdate}
              disabled={actionLoading}
              className="w-full bg-primary text-primary-foreground"
            >
              {actionLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-border mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deletar Template</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar "{selectedTemplate?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Deletando...' : 'Deletar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
