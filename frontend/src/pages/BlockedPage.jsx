import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Lock, MessageSquare } from 'lucide-react';

export default function BlockedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reason = location.state?.reason || 'blocked';
  
  const isExpired = reason === 'expired';
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-destructive/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-destructive/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-destructive/20 mx-auto mb-4 flex items-center justify-center">
            {isExpired ? (
              <Clock className="w-8 h-8 text-destructive" />
            ) : (
              <Lock className="w-8 h-8 text-destructive" />
            )}
          </div>
          <h1 className="font-heading font-bold text-3xl text-foreground">NEXUZAP</h1>
          <p className="text-destructive font-mono text-sm mt-1">ACESSO RESTRITO</p>
        </div>

        {/* Card */}
        <Card className="glass-card border-destructive/20 animate-fade-in">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 mx-auto mb-4 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            
            <h2 className="font-heading font-bold text-xl text-foreground mb-2">
              {isExpired ? 'Conta Expirada' : 'Conta Bloqueada'}
            </h2>
            
            <p className="text-muted-foreground text-sm mb-6">
              {isExpired 
                ? 'Seu período de acesso expirou. Entre em contato com seu administrador para renovar sua conta.'
                : 'Sua conta está bloqueada. Entre em contato com seu administrador para mais informações.'
              }
            </p>

            <div className="space-y-3">
              <div className="p-4 bg-muted/30 rounded-lg text-left">
                <h3 className="text-sm font-medium text-foreground mb-2">O que fazer?</h3>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Entre em contato com seu administrador</li>
                  <li>• {isExpired ? 'Solicite a renovação da sua conta' : 'Solicite o desbloqueio da sua conta'}</li>
                  <li>• Aguarde a liberação do acesso</li>
                </ul>
              </div>

              <Button
                onClick={() => {
                  localStorage.removeItem('token');
                  navigate('/login');
                }}
                variant="outline"
                className="w-full border-border text-foreground"
              >
                Voltar ao Login
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs">NexuZap - Campanhas WhatsApp</span>
          </div>
        </div>
      </div>
    </div>
  );
}
