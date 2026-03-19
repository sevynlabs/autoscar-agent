'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'operator' });

  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const addUser = async () => {
    if (!form.email || !form.password || !form.name) return;
    await api.post('/users', form);
    setForm({ email: '', password: '', name: '', role: 'operator' });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Excluir este usuário?')) return;
    await api.delete(`/users/${id}`);
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>

      <Card>
        <CardHeader><CardTitle>Usuários</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {users?.map(user => (
            <div key={user.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <span className="font-medium">{user.name}</span>
                <span className="text-sm text-muted-foreground ml-2">{user.email}</span>
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="ml-2">
                  {user.role}
                </Badge>
              </div>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteUser(user.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Adicionar Usuário</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input placeholder="Senha" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="operator">Operador</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addUser} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
