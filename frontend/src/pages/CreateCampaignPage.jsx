import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionsStore, useGroupsStore, useCampaignsStore, useImagesStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function CreateCampaignPage() {
  const navigate = useNavigate();
  const { connections, fetchConnections } = useConnectionsStore();
  const { fetchGroupsByConnection } = useGroupsStore();
  const { createCampaign } = useCampaignsStore();
  const { images, fetchImages, uploadImage } = useImagesStore();
  
  const [title, setTitle] = useState('');
  const [selectedConnection, setSelectedConnection] = useState('');
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchConnections();
    fetchImages();
  }, [fetchConnections, fetchImages]);

  useEffect(() => {
    if (selectedConnection) {
      loadGroups(selectedConnection);
    } else {
      setGroups([]);
      setSelectedGroups([]);
    }
  }, [selectedConnection]);

  const loadGroups = async (connectionId) => {
    setLoadingGroups(true);
    try {
      const data = await fetchGroupsByConnection(connectionId);
      setGroups(data);
    } catch (error) {
      toast.error('Erro ao carregar grupos');
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const image = await uploadImage(file);
      setSelectedImage(image.id);
      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao enviar imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleGroup = (groupId) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const selectAllGroups = () => {
    if (selectedGroups.length === groups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(groups.map((g) => g.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Digite um título para a campanha');
      return;
    }
    if (!selectedConnection) {
      toast.error('Selecione uma conexão');
      return;
    }
    if (selectedGroups.length === 0) {
      toast.error('Selecione pelo menos um grupo');
      return;
    }
    if (!message.trim() && !selectedImage) {
      toast.error('Digite uma mensagem ou selecione uma imagem');
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      toast.error('Defina a data e hora do disparo');
      return;
    }

    // Combine date and time into ISO format
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
    
    // Validate if date is in the past
    if (scheduledDateTime < new Date()) {
      toast.error('A data/hora do disparo não pode ser no passado');
      return;
    }

    setLoading(true);
    try {
      await createCampaign({
        title: title.trim(),
        connection_id: selectedConnection,
        group_ids: selectedGroups,
        message: message.trim() || null,
        image_id: selectedImage || null,
        scheduled_time: scheduledDateTime.toISOString(),
        delay_seconds: delaySeconds,
      });
      toast.success('Campanha criada com sucesso!');
      navigate('/campaigns');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar campanha');
    } finally {
      setLoading(false);
    }
  };

  const activeConnections = connections.filter((c) => c.status === 'connected');

  return (
    <div data-testid="create-campaign-page" className="space-y-8 animate-fade-in max-w-4xl">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate('/campaigns')}
          className="mb-4 text-muted-foreground hover:text-foreground"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </Button>
        <h1 className="font-heading font-bold text-3xl text-foreground tracking-tight">Nova Campanha</h1>
        <p className="text-muted-foreground mt-1">
          Configure sua campanha de mensagens
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card className="glass-card">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="font-heading font-semibold text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Título da Campanha
              </Label>
              <Input
                data-testid="campaign-title-input"
                placeholder="Ex: Promoção Black Friday"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-12 bg-black/40 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Conexão WhatsApp
              </Label>
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger data-testid="connection-select" className="h-12 bg-black/40 border-white/10">
                  <SelectValue placeholder="Selecione uma conexão" />
                </SelectTrigger>
                <SelectContent className="glass-card border-white/10">
                  {activeConnections.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Nenhuma conexão ativa. 
                      <Button 
                        variant="link" 
                        className="text-primary p-0 h-auto ml-1"
                        onClick={() => navigate('/connections')}
                      >
                        Conectar agora
                      </Button>
                    </div>
                  ) : (
                    activeConnections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          {conn.name} - {conn.phone_number}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Groups Selection */}
        <Card className="glass-card">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading font-semibold text-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Grupos ({selectedGroups.length} selecionados)
              </CardTitle>
              {groups.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllGroups}
                  className="text-primary"
                >
                  {selectedGroups.length === groups.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {!selectedConnection ? (
              <div className="text-center py-8 text-muted-foreground">
                Selecione uma conexão para ver os grupos disponíveis
              </div>
            ) : loadingGroups ? (
              <div className="text-center py-8 text-muted-foreground animate-pulse">
                Carregando grupos...
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum grupo encontrado nesta conexão
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    data-testid={`group-checkbox-${group.id}`}
                    onClick={() => toggleGroup(group.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedGroups.includes(group.id)
                        ? 'bg-primary/10 border border-primary/30'
                        : 'bg-black/20 border border-white/5 hover:border-white/10'
                    }`}
                  >
                    <Checkbox
                      checked={selectedGroups.includes(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {group.participants_count} participantes
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Content */}
        <Card className="glass-card">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="font-heading font-semibold text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Conteúdo da Mensagem
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Imagem (opcional)
              </Label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Select value={selectedImage} onValueChange={setSelectedImage}>
                    <SelectTrigger className="h-12 bg-black/40 border-white/10">
                      <SelectValue placeholder="Selecione uma imagem" />
                    </SelectTrigger>
                    <SelectContent className="glass-card border-white/10">
                      <SelectItem value="">Sem imagem</SelectItem>
                      {images.map((img) => (
                        <SelectItem key={img.id} value={img.id}>
                          {img.original_name || img.filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploadingImage}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 border-white/10 hover:bg-white/5"
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {selectedImage && images.find((i) => i.id === selectedImage) && (
                <div className="mt-2 p-2 bg-black/40 rounded-lg inline-flex items-center gap-2">
                  <img 
                    src={`${process.env.REACT_APP_BACKEND_URL}${images.find((i) => i.id === selectedImage)?.url}`}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedImage('')}
                    className="text-destructive"
                  >
                    Remover
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Mensagem {selectedImage ? '(legenda da imagem)' : ''}
              </Label>
              <Textarea
                data-testid="campaign-message-input"
                placeholder="Digite sua mensagem aqui..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-32 bg-black/40 border-white/10 resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {message.length} caracteres
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="glass-card">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="font-heading font-semibold text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Agendamento
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Data
                </Label>
                <Input
                  data-testid="campaign-date-input"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="h-12 bg-black/40 border-white/10"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Hora (Brasília)
                </Label>
                <Input
                  data-testid="campaign-time-input"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="h-12 bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Delay entre mensagens (segundos)
                </Label>
                <Input
                  data-testid="campaign-delay-input"
                  type="number"
                  min={1}
                  max={60}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 5)}
                  className="h-12 bg-black/40 border-white/10"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              O delay é o intervalo entre o envio de cada mensagem para os grupos selecionados.
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/campaigns')}
            className="border-white/10 hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            data-testid="create-campaign-submit"
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow px-8"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Criando...
              </span>
            ) : (
              'Criar Campanha'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
