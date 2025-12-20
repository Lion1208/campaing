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
import { ArrowLeft, Upload, Info, Clock, Users, Image, MessageSquare, X } from 'lucide-react';

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
  const [selectedImage, setSelectedImage] = useState('none');
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
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchConnections();
    fetchImages();
  }, [fetchConnections, fetchImages]);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const image = await uploadImage(file);
      setSelectedImage(image.id);
      toast.success('Imagem enviada!');
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
    if (!message.trim() && selectedImage === 'none') {
      toast.error('Digite uma mensagem ou selecione uma imagem');
      return;
    }

    // Validate schedule
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
      if (scheduledDateTime < new Date()) {
        toast.error('A data/hora não pode ser no passado');
        return;
      }
    }

    setLoading(true);
    try {
      await createCampaign({
        title: title.trim(),
        connection_id: selectedConnection,
        group_ids: selectedGroups,
        message: message.trim() || null,
        image_id: selectedImage === 'none' ? null : selectedImage,
        schedule_type: scheduleType,
        scheduled_time: scheduledDateTime ? scheduledDateTime.toISOString() : null,
        interval_hours: scheduleType === 'interval' ? parseInt(intervalHours) : null,
        specific_times: scheduleType === 'specific_times' ? specificTimes : null,
        start_date: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null,
        end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
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
    <div data-testid="create-campaign-page" className="space-y-6 animate-fade-in max-w-3xl mx-auto">
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
              <Label>Título da Campanha</Label>
              <Input
                data-testid="campaign-title-input"
                placeholder="Ex: Promoção Black Friday"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Conexão WhatsApp</Label>
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger data-testid="connection-select" className="bg-background/50">
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

        {/* Message Content */}
        <Card className="glass-card">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-primary mb-2">
              <MessageSquare className="w-4 h-4" />
              <span className="font-medium text-sm">Conteúdo</span>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Imagem (opcional)
              </Label>
              <div className="flex gap-2">
                <Select value={selectedImage} onValueChange={setSelectedImage} className="flex-1">
                  <SelectTrigger className="bg-background/50">
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
                  <Button type="button" variant="outline" disabled={uploadingImage} className="border-white/10">
                    {uploadingImage ? (
                      <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mensagem {selectedImage !== 'none' ? '(legenda)' : ''}</Label>
              <Textarea
                data-testid="campaign-message-input"
                placeholder="Digite sua mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-24 bg-background/50 resize-none"
              />
              <p className="text-xs text-muted-foreground">{message.length} caracteres</p>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="glass-card">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Clock className="w-4 h-4" />
              <span className="font-medium text-sm">Agendamento</span>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Disparo</Label>
              <Select value={scheduleType} onValueChange={setScheduleType}>
                <SelectTrigger className="bg-background/50">
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
                  <Label>Data</Label>
                  <Input
                    data-testid="campaign-date-input"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora (Brasília)</Label>
                  <Input
                    data-testid="campaign-time-input"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
              </div>
            )}

            {scheduleType === 'interval' && (
              <>
                <div className="space-y-2">
                  <Label>Repetir a cada</Label>
                  <Select value={intervalHours} onValueChange={setIntervalHours}>
                    <SelectTrigger className="bg-background/50">
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
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim (opcional)</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="bg-background/50"
                    />
                  </div>
                </div>
              </>
            )}

            {scheduleType === 'specific_times' && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Horários de Disparo</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addSpecificTime} className="text-primary -mr-2">
                      + Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {specificTimes.map((time, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          type="time"
                          value={time}
                          onChange={(e) => updateSpecificTime(index, e.target.value)}
                          className="bg-background/50 flex-1"
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
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim (opcional)</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="bg-background/50"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Delay entre mensagens (segundos)</Label>
              <Input
                data-testid="campaign-delay-input"
                type="number"
                min={1}
                max={300}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 5)}
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">
                Intervalo entre o envio de cada mensagem para os grupos
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/campaigns')}
            className="flex-1 border-white/10"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            data-testid="create-campaign-submit"
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
