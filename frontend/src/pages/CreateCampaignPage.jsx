import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionsStore, useGroupsStore, useCampaignsStore, useImagesStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Info, Clock, Users, Image, MessageSquare, X, Plus, Trash2 } from 'lucide-react';

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
  
  // Múltiplas mensagens/imagens
  const [messageItems, setMessageItems] = useState([{ message: '', imageId: 'none', imagePreview: null }]);
  
  const [scheduleType, setScheduleType] = useState('once');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [intervalHours, setIntervalHours] = useState('1');
  const [specificTimes, setSpecificTimes] = useState(['09:00']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);

  // Preview animado
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    fetchConnections();
    fetchImages();
  }, [fetchConnections, fetchImages]);

  // Preview animation - alterna a cada 5 segundos quando há mais de 1 item
  useEffect(() => {
    if (messageItems.length <= 1) return;
    
    const interval = setInterval(() => {
      setPreviewIndex(prev => (prev + 1) % messageItems.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [messageItems.length]);

  const loadGroups = useCallback(async (connectionId) => {
    setLoadingGroups(true);
    try {
      const data = await fetchGroupsByConnection(connectionId);
      setGroups(data);
    } catch (error) {
      toast.error('Erro ao carregar grupos');
    } finally {
      setLoadingGroups(false);
    }
  }, [fetchGroupsByConnection]);

  useEffect(() => {
    if (selectedConnection) {
      loadGroups(selectedConnection);
    } else {
      setGroups([]);
      setSelectedGroups([]);
    }
  }, [selectedConnection, loadGroups]);

  const handleImageUpload = async (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Cria preview local imediatamente (não usa URL do servidor)
    const localPreview = URL.createObjectURL(file);
    const newItems = [...messageItems];
    newItems[index].imagePreview = localPreview;
    setMessageItems(newItems);

    setUploadingIndex(index);
    try {
      const image = await uploadImage(file);
      // Atualiza apenas o imageId, mantém o preview local
      const updatedItems = [...messageItems];
      updatedItems[index].imageId = image.id;
      updatedItems[index].imagePreview = localPreview; // Mantém o blob URL
      setMessageItems(updatedItems);
      toast.success('Imagem enviada!');
    } catch (error) {
      // Se falhou, remove o preview
      const updatedItems = [...messageItems];
      updatedItems[index].imagePreview = null;
      setMessageItems(updatedItems);
      toast.error(error.response?.data?.detail || 'Erro ao enviar imagem');
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleImageSelect = (index, imageId) => {
    const newItems = [...messageItems];
    newItems[index].imageId = imageId;
    if (imageId === 'none') {
      newItems[index].imagePreview = null;
    } else {
      // Para imagens já existentes, usa a URL do servidor como fallback
      const img = images.find(i => i.id === imageId);
      if (img) {
        // Tenta carregar a imagem como blob
        fetch(`${process.env.REACT_APP_BACKEND_URL}${img.url}`)
          .then(res => res.blob())
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            setMessageItems(prev => {
              const updated = [...prev];
              updated[index].imagePreview = blobUrl;
              return updated;
            });
          })
          .catch(() => {
            // Fallback: não mostra preview se não conseguir carregar
            setMessageItems(prev => {
              const updated = [...prev];
              updated[index].imagePreview = null;
              return updated;
            });
          });
      }
    }
    setMessageItems(newItems);
  };

  const handleMessageChange = (index, value) => {
    const newItems = [...messageItems];
    newItems[index].message = value;
    setMessageItems(newItems);
  };

  const addMessageItem = () => {
    setMessageItems([...messageItems, { message: '', imageId: 'none', imagePreview: null }]);
  };

  const removeMessageItem = (index) => {
    if (messageItems.length <= 1) return;
    setMessageItems(messageItems.filter((_, i) => i !== index));
    if (previewIndex >= messageItems.length - 1) {
      setPreviewIndex(0);
    }
  };

  const removeImage = (index) => {
    const newItems = [...messageItems];
    newItems[index].imageId = 'none';
    newItems[index].imagePreview = null;
    setMessageItems(newItems);
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

  const addSpecificTime = () => {
    setSpecificTimes([...specificTimes, '12:00']);
  };

  const removeSpecificTime = (index) => {
    setSpecificTimes(specificTimes.filter((_, i) => i !== index));
  };

  const updateSpecificTime = (index, value) => {
    const newTimes = [...specificTimes];
    newTimes[index] = value;
    setSpecificTimes(newTimes);
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
    
    // Verifica se tem pelo menos uma mensagem ou imagem
    const hasContent = messageItems.some(item => item.message.trim() || item.imageId !== 'none');
    if (!hasContent) {
      toast.error('Adicione pelo menos uma mensagem ou imagem');
      return;
    }

    if (scheduleType === 'once' && (!scheduledDate || !scheduledTime)) {
      toast.error('Defina a data e hora do disparo');
      return;
    }
    if (scheduleType !== 'once' && !startDate) {
      toast.error('Defina a data de início');
      return;
    }

    let scheduledDateTime = null;
    if (scheduleType === 'once') {
      scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
    }

    // Prepara as mensagens
    const messages = messageItems.map(item => ({
      message: item.message.trim() || null,
      image_id: item.imageId === 'none' ? null : item.imageId
    }));

    setLoading(true);
    try {
      await createCampaign({
        title: title.trim(),
        connection_id: selectedConnection,
        group_ids: selectedGroups,
        message: messages.length === 1 ? messages[0].message : null,
        image_id: messages.length === 1 ? messages[0].image_id : null,
        messages: messages.length > 1 ? messages : null,
        schedule_type: scheduleType,
        scheduled_time: scheduledDateTime ? scheduledDateTime.toISOString() : null,
        interval_hours: scheduleType === 'interval' ? parseInt(intervalHours) : null,
        specific_times: scheduleType === 'specific_times' ? specificTimes : null,
        start_date: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null,
        end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
        delay_seconds: delaySeconds,
      });
      toast.success('Campanha criada! Ela está pausada, clique em Iniciar quando quiser.');
      navigate('/campaigns');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar campanha');
    } finally {
      setLoading(false);
    }
  };

  const activeConnections = connections.filter((c) => c.status === 'connected');

  // Pega o item atual do preview
  const currentPreviewItem = messageItems[previewIndex] || messageItems[0];

  return (
    <div data-testid="create-campaign-page" className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate('/campaigns')}
          className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
          size="sm"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Voltar
        </Button>
        <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Nova Campanha</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure sua campanha de mensagens</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info */}
        <Card className="glass-card">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Info className="w-4 h-4" />
              <span className="font-medium text-sm">Informações Básicas</span>
            </div>
            
            <div className="space-y-2">
              <Label className="text-foreground">Título da Campanha</Label>
              <Input
                data-testid="campaign-title-input"
                placeholder="Ex: Promoção Black Friday"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-muted/50 border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Conexão WhatsApp</Label>
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger data-testid="connection-select" className="bg-muted/50 border-border text-foreground">
                  <SelectValue placeholder="Selecione uma conexão" />
                </SelectTrigger>
                <SelectContent>
                  {activeConnections.length === 0 ? (
                    <div className="p-3 text-center text-muted-foreground text-sm">
                      Nenhuma conexão ativa
                    </div>
                  ) : (
                    activeConnections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        {conn.name} - {conn.phone_number}
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
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-primary">
                <Users className="w-4 h-4" />
                <span className="font-medium text-sm">Grupos ({selectedGroups.length} selecionados)</span>
              </div>
              {groups.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={selectAllGroups} className="text-primary -mr-2">
                  {selectedGroups.length === groups.length ? 'Desmarcar' : 'Selecionar'} Todos
                </Button>
              )}
            </div>
            
            {!selectedConnection ? (
              <p className="text-center py-6 text-muted-foreground text-sm">
                Selecione uma conexão para ver os grupos
              </p>
            ) : loadingGroups ? (
              <div className="text-center py-6">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : groups.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">
                Nenhum grupo encontrado
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {groups.map((group) => {
                  const isSelected = selectedGroups.includes(group.id);
                  return (
                    <div
                      key={group.id}
                      onClick={() => toggleGroup(group.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary/15 border border-primary/30'
                          : 'bg-muted/30 border border-transparent hover:border-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
                        <p className="text-xs text-muted-foreground">{group.participants_count} participantes</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Content - Multiple Messages */}
        <Card className="glass-card">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <MessageSquare className="w-4 h-4" />
                <span className="font-medium text-sm">Conteúdo ({messageItems.length} mensage{messageItems.length > 1 ? 'ns' : 'm'})</span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={addMessageItem} className="text-primary -mr-2">
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Variação
              </Button>
            </div>

            {messageItems.length > 1 && (
              <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                💡 Com múltiplas variações, o sistema escolherá aleatoriamente qual enviar a cada disparo.
              </p>
            )}

            <div className="space-y-4">
              {messageItems.map((item, index) => (
                <div key={index} className="p-4 bg-muted/20 rounded-lg border border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Variação {index + 1}</span>
                    {messageItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMessageItem(index)}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-2">
                    <Label className="text-foreground flex items-center gap-2 text-sm">
                      <Image className="w-4 h-4" />
                      Imagem (opcional)
                    </Label>
                    <div className="flex gap-2">
                      <Select value={item.imageId} onValueChange={(v) => handleImageSelect(index, v)}>
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
                          onChange={(e) => handleImageUpload(e, index)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={uploadingIndex === index}
                        />
                        <Button type="button" variant="outline" disabled={uploadingIndex === index} className="border-border">
                          {uploadingIndex === index ? (
                            <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Image Preview */}
                    {item.imagePreview && (
                      <div className="relative inline-block mt-2">
                        <img 
                          src={item.imagePreview}
                          alt="Preview"
                          className="h-20 rounded-lg object-cover border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Message Text */}
                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">
                      Mensagem {item.imageId !== 'none' ? '(legenda)' : ''}
                    </Label>
                    <Textarea
                      placeholder="Digite sua mensagem..."
                      value={item.message}
                      onChange={(e) => handleMessageChange(index, e.target.value)}
                      className="min-h-20 bg-muted/50 border-border text-foreground resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Preview Card - Animated */}
        {messageItems.some(item => item.message || item.imagePreview) && (
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-primary">Preview da Mensagem</span>
                {messageItems.length > 1 && (
                  <span className="text-xs text-muted-foreground">
                    {previewIndex + 1}/{messageItems.length} (alterna a cada 5s)
                  </span>
                )}
              </div>
              
              <div className="bg-[#0B141A] rounded-lg p-4 h-[180px] overflow-hidden transition-all duration-500">
                <div className={`transition-opacity duration-300 h-full flex flex-col ${messageItems.length > 1 ? 'animate-fade-in' : ''}`} key={previewIndex}>
                  {currentPreviewItem.imagePreview && (
                    <img 
                      src={currentPreviewItem.imagePreview}
                      alt="Preview"
                      className="w-full max-w-[180px] h-24 object-cover rounded-lg mb-2 flex-shrink-0"
                    />
                  )}
                  {currentPreviewItem.message ? (
                    <div className="relative flex-1 overflow-hidden">
                      <p className="text-white text-sm whitespace-pre-wrap line-clamp-4">{currentPreviewItem.message}</p>
                      {currentPreviewItem.message.length > 150 && (
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0B141A] to-transparent" />
                      )}
                    </div>
                  ) : !currentPreviewItem.imagePreview ? (
                    <p className="text-gray-500 text-sm italic">Mensagem vazia</p>
                  ) : null}
                </div>
              </div>

              {/* Preview dots for multiple messages */}
              {messageItems.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {messageItems.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPreviewIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === previewIndex ? 'bg-primary w-4' : 'bg-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Schedule */}
        <Card className="glass-card">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Clock className="w-4 h-4" />
              <span className="font-medium text-sm">Agendamento</span>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Tipo de Disparo</Label>
              <Select value={scheduleType} onValueChange={setScheduleType}>
                <SelectTrigger className="bg-muted/50 border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Disparo Único</SelectItem>
                  <SelectItem value="interval">Repetir por Intervalo</SelectItem>
                  <SelectItem value="specific_times">Horários Específicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleType === 'once' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-foreground">Data</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="bg-muted/50 border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Hora (Brasília)</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="bg-muted/50 border-border text-foreground"
                  />
                </div>
              </div>
            )}

            {scheduleType === 'interval' && (
              <>
                <div className="space-y-2">
                  <Label className="text-foreground">Repetir a cada</Label>
                  <Select value={intervalHours} onValueChange={setIntervalHours}>
                    <SelectTrigger className="bg-muted/50 border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hora</SelectItem>
                      <SelectItem value="2">2 horas</SelectItem>
                      <SelectItem value="3">3 horas</SelectItem>
                      <SelectItem value="4">4 horas</SelectItem>
                      <SelectItem value="6">6 horas</SelectItem>
                      <SelectItem value="8">8 horas</SelectItem>
                      <SelectItem value="12">12 horas</SelectItem>
                      <SelectItem value="24">24 horas (diário)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-foreground">Data Início</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-muted/50 border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Data Fim (opcional)</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-muted/50 border-border text-foreground"
                    />
                  </div>
                </div>
              </>
            )}

            {scheduleType === 'specific_times' && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground">Horários de Disparo</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addSpecificTime} className="text-primary -mr-2">
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {specificTimes.map((time, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          type="time"
                          value={time}
                          onChange={(e) => updateSpecificTime(index, e.target.value)}
                          className="bg-muted/50 border-border text-foreground flex-1"
                        />
                        {specificTimes.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSpecificTime(index)}
                            className="text-destructive hover:bg-destructive/10 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-foreground">Data Início</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-muted/50 border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">Data Fim (opcional)</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-muted/50 border-border text-foreground"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label className="text-foreground">Delay entre mensagens (segundos)</Label>
              <Input
                type="number"
                min={1}
                max={300}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 5)}
                className="bg-muted/50 border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">Tempo de espera entre o envio para cada grupo</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/campaigns')}
            className="flex-1 border-border text-foreground"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
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
