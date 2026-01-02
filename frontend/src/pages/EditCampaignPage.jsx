import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnectionsStore, useGroupsStore, useCampaignsStore, useImagesStore, api } from '@/store';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Info, Clock, Users, Image, MessageSquare, X, Plus, Trash2 } from 'lucide-react';

export default function EditCampaignPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { connections, fetchConnections } = useConnectionsStore();
  const { fetchGroupsByConnection } = useGroupsStore();
  const { updateCampaign } = useCampaignsStore();
  const { images, fetchImages, uploadImage } = useImagesStore();
  
  const [campaign, setCampaign] = useState(null);
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
  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);

  // Preview animado
  const [previewIndex, setPreviewIndex] = useState(0);

  // Função para carregar imagem via API (evita problemas de CORS/redirect)
  const loadImageFromApi = useCallback(async (imageId) => {
    if (!imageId || imageId === 'none') return null;
    try {
      const response = await api.get(`/images/${imageId}/file`, { responseType: 'blob' });
      return URL.createObjectURL(response.data);
    } catch (error) {
      console.error('Error loading image:', error);
      return null;
    }
  }, []);

  // Função para carregar grupos (definida ANTES dos useEffects que a usam)
  const loadGroups = useCallback(async (connectionId, preSelectedGroups = []) => {
    setLoadingGroups(true);
    try {
      const data = await fetchGroupsByConnection(connectionId);
      setGroups(data);
      
      // Se há grupos pré-selecionados (ao carregar a campanha), validar e filtrar apenas os que existem
      if (preSelectedGroups.length > 0) {
        const validGroupIds = data.map(g => g.id);
        const validSelectedGroups = preSelectedGroups.filter(id => validGroupIds.includes(id));
        
        if (validSelectedGroups.length !== preSelectedGroups.length) {
          console.warn(`${preSelectedGroups.length - validSelectedGroups.length} grupo(s) da campanha não existem mais`);
          toast.info(`Alguns grupos da campanha não existem mais. Foram removidos da seleção.`);
        }
        
        setSelectedGroups(validSelectedGroups);
      }
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
      // Se a conexão não existe mais, limpar a seleção
      if (error.response?.status === 404) {
        setSelectedConnection('');
        setGroups([]);
        setSelectedGroups([]);  // Limpar grupos selecionados também
        toast.error('Conexão não encontrada. Selecione outra conexão.');
      } else {
        toast.error('Erro ao carregar grupos');
      }
    } finally {
      setLoadingGroups(false);
    }
  }, [fetchGroupsByConnection]);

  // Load campaign data
  useEffect(() => {
    const loadCampaign = async () => {
      try {
        const response = await api.get(`/campaigns/${id}`);
        const data = response.data;
        setCampaign(data);
        setTitle(data.title);
        setSelectedConnection(data.connection_id);
        // NÃO setar selectedGroups aqui - será setado quando loadGroups for chamado
        // Armazenar temporariamente para passar ao loadGroups
        const groupIdsToSelect = data.group_ids || [];
        
        setScheduleType(data.schedule_type || 'once');
        setIntervalHours(String(data.interval_hours || 1));
        setSpecificTimes(data.specific_times || ['09:00']);
        setDelaySeconds(data.delay_seconds || 5);
        
        // Carrega mensagens com preview de imagem via API
        if (data.messages && data.messages.length > 0) {
          const loadedItems = await Promise.all(
            data.messages.map(async (msg) => {
              let imagePreview = null;
              if (msg.image_id) {
                imagePreview = await loadImageFromApi(msg.image_id);
              }
              return {
                message: msg.message || '',
                imageId: msg.image_id || 'none',
                imagePreview
              };
            })
          );
          setMessageItems(loadedItems);
        } else {
          // Modo de mensagem única
          let imagePreview = null;
          if (data.image_id) {
            imagePreview = await loadImageFromApi(data.image_id);
          }
          setMessageItems([{
            message: data.message || '',
            imageId: data.image_id || 'none',
            imagePreview
          }]);
        }
        
        if (data.scheduled_time) {
          const dt = new Date(data.scheduled_time);
          setScheduledDate(dt.toISOString().split('T')[0]);
          setScheduledTime(dt.toTimeString().slice(0, 5));
        }
        if (data.start_date) {
          setStartDate(new Date(data.start_date).toISOString().split('T')[0]);
        }
        if (data.end_date) {
          setEndDate(new Date(data.end_date).toISOString().split('T')[0]);
        }
        
        // Carregar grupos COM os IDs pré-selecionados
        if (data.connection_id) {
          await loadGroups(data.connection_id, groupIdsToSelect);
        }
      } catch (error) {
        toast.error('Erro ao carregar campanha');
        navigate('/campaigns');
      } finally {
        setLoadingCampaign(false);
      }
    };

    loadCampaign();
    fetchConnections();
    fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate, fetchConnections, fetchImages, loadImageFromApi]);

  // Preview animation
  useEffect(() => {
    if (messageItems.length <= 1) return;
    
    const interval = setInterval(() => {
      setPreviewIndex(prev => (prev + 1) % messageItems.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [messageItems.length]);

  useEffect(() => {
    // Este useEffect só deve rodar quando o usuário MUDA a conexão manualmente
    // Não quando a conexão é setada pela primeira vez ao carregar a campanha
    if (!campaign) return; // Ainda está carregando a campanha
    
    if (selectedConnection) {
      // Verifica se a conexão selecionada existe nas conexões disponíveis
      const connectionExists = connections.some(c => c.id === selectedConnection);
      if (!connectionExists && connections.length > 0) {
        console.warn('Conexão da campanha não existe mais:', selectedConnection);
        toast.error('A conexão desta campanha não existe mais. Selecione outra.');
        setSelectedConnection('');
        setGroups([]);
        setSelectedGroups([]);  // Limpar grupos selecionados também
        return;
      }
      
      // Se a conexão mudou (usuário selecionou outra), carregar grupos sem pré-seleção
      if (selectedConnection !== campaign.connection_id) {
        loadGroups(selectedConnection);
      }
    } else {
      setGroups([]);
    }
  }, [selectedConnection, loadGroups, connections, campaign]);

  const handleImageUpload = async (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Cria preview local imediatamente
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
      updatedItems[index].imagePreview = localPreview;
      setMessageItems(updatedItems);
      toast.success('Imagem enviada!');
    } catch (error) {
      const updatedItems = [...messageItems];
      updatedItems[index].imagePreview = null;
      setMessageItems(updatedItems);
      toast.error(error.response?.data?.detail || 'Erro ao enviar imagem');
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleImageSelect = async (index, imageId) => {
    const newItems = [...messageItems];
    newItems[index].imageId = imageId;
    
    if (imageId === 'none') {
      newItems[index].imagePreview = null;
    } else {
      // Carrega preview via API
      const blobUrl = await loadImageFromApi(imageId);
      newItems[index].imagePreview = blobUrl;
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
      await updateCampaign(id, {
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
      toast.success('Campanha atualizada!');
      navigate('/campaigns');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar campanha');
    } finally {
      setLoading(false);
    }
  };

  const activeConnections = connections.filter((c) => c.status === 'connected');
  const currentPreviewItem = messageItems[previewIndex] || messageItems[0];

  if (loadingCampaign) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="edit-campaign-page" className="space-y-6 animate-fade-in max-w-4xl mx-auto">
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
        <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Editar Campanha</h1>
        <p className="text-muted-foreground text-sm mt-1">Atualize os dados da campanha</p>
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
                placeholder="Ex: Promoção Black Friday"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-muted/50 border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Conexão WhatsApp</Label>
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger className="bg-muted/50 border-border text-foreground">
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

        {/* Message Content - Multiple Messages with Accordion */}
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

            {/* Single message - show without accordion */}
            {messageItems.length === 1 ? (
              <div className="p-4 bg-muted/20 rounded-lg border border-border/50 space-y-3">
                {/* Image Upload */}
                <div className="space-y-2">
                  <Label className="text-foreground flex items-center gap-2 text-sm">
                    <Image className="w-4 h-4" />
                    Imagem (opcional)
                  </Label>
                  <div className="flex gap-2">
                    <Select value={messageItems[0].imageId} onValueChange={(v) => handleImageSelect(0, v)}>
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
                        onChange={(e) => handleImageUpload(e, 0)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploadingIndex === 0}
                      />
                      <Button type="button" variant="outline" disabled={uploadingIndex === 0} className="border-border">
                        {uploadingIndex === 0 ? (
                          <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Image Preview */}
                  {messageItems[0].imagePreview && (
                    <div className="relative inline-block mt-2">
                      <img 
                        src={messageItems[0].imagePreview}
                        alt="Preview"
                        className="h-20 rounded-lg object-cover border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(0)}
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
                    Mensagem {messageItems[0].imageId !== 'none' ? '(legenda)' : ''}
                  </Label>
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={messageItems[0].message}
                    onChange={(e) => handleMessageChange(0, e.target.value)}
                    className="min-h-20 bg-muted/50 border-border text-foreground resize-none"
                  />
                </div>
              </div>
            ) : (
              /* Multiple messages - use Accordion (collapsed by default) */
              <Accordion type="multiple" className="space-y-2">
                {messageItems.map((item, index) => (
                  <AccordionItem 
                    key={index} 
                    value={`item-${index}`}
                    className="border border-border/50 rounded-lg bg-muted/20 px-4"
                  >
                    <div className="flex items-center justify-between py-3">
                      <AccordionTrigger className="hover:no-underline flex-1 py-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">Variação {index + 1}</span>
                          {item.imagePreview && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">📷 Imagem</span>
                          )}
                          {item.message && (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {item.message.slice(0, 30)}{item.message.length > 30 ? '...' : ''}
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); removeMessageItem(index); }}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <AccordionContent className="pb-4 space-y-3">
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
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
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

              {/* Preview dots */}
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
                <div className="space-y-3">
                  <Label className="text-foreground">Horários de Disparo (Brasília)</Label>
                  <p className="text-xs text-muted-foreground">Selecione os horários em que deseja enviar</p>
                  
                  {/* Manual Time Input */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Adicionar horário personalizado</Label>
                      <Input
                        type="time"
                        id="custom-time-input-edit"
                        className="bg-muted/50 border-border text-foreground"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const time = e.target.value;
                            if (time && !specificTimes.includes(time)) {
                              setSpecificTimes([...specificTimes, time].sort());
                              e.target.value = '';
                            }
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.getElementById('custom-time-input-edit');
                        if (input && input.value && !specificTimes.includes(input.value)) {
                          setSpecificTimes([...specificTimes, input.value].sort());
                          input.value = '';
                        }
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  
                  {/* Time Grid Selector (horários inteiros apenas como atalho) */}
                  <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Atalhos rápidos (horários inteiros):</p>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = String(i).padStart(2, '0');
                        const timeValue = `${hour}:00`;
                        const isSelected = specificTimes.includes(timeValue);
                        return (
                          <button
                            key={hour}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSpecificTimes(specificTimes.filter(t => t !== timeValue));
                              } else {
                                setSpecificTimes([...specificTimes, timeValue].sort());
                              }
                            }}
                            className={`
                              py-2 px-1 rounded-lg text-xs font-mono transition-all
                              ${isSelected 
                                ? 'bg-primary text-primary-foreground ring-2 ring-primary/50' 
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                              }
                            `}
                          >
                            {hour}:00
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Selected times summary */}
                    {specificTimes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-2">
                          {specificTimes.length} horário{specificTimes.length > 1 ? 's' : ''} selecionado{specificTimes.length > 1 ? 's' : ''}:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {specificTimes.sort().map((time) => (
                            <span
                              key={time}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/15 text-primary rounded text-xs font-mono"
                            >
                              {time}
                              <button
                                type="button"
                                onClick={() => setSpecificTimes(specificTimes.filter(t => t !== time))}
                                className="hover:text-destructive"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {specificTimes.length === 0 && (
                      <p className="text-xs text-yellow-500 mt-3">⚠️ Selecione pelo menos um horário</p>
                    )}
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
                Salvando...
              </span>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
