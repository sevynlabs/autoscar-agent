'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Users, Shield, User } from 'lucide-react';

interface UserType { id: string; email: string; name: string; role: string; createdAt: string; }

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'operator' });

  const { data: users } = useQuery<UserType[]>({ queryKey: ['users'], queryFn: () => api.get('/users') });

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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Usuários</h1>
          <p className="text-xs text-slate-500">Gerencie equipe e permissões</p>
        </div>
      </div>

      {/* User list */}
      <div className="glass-card rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Equipe</h2>
          <Badge className="ml-auto bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/20 text-xs">{users?.length ?? 0}</Badge>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {users?.map(user => (
            <div key={user.id} className="flex items-center gap-3 px-5 py-3.5 group hover:bg-white/[0.02] transition-colors">
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                {user.role === 'admin' ? <Shield className="h-4 w-4 text-red-600 dark:text-red-400" /> : <User className="h-4 w-4 text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <Badge className={`text-xs ${
                user.role === 'admin'
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/20'
                  : 'bg-white/5 text-slate-400 border-white/10'
              }`}>{user.role}</Badge>
              <Button size="icon" variant="ghost" onClick={() => deleteUser(user.id)}
                className="h-8 w-8 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Add user */}
      <div className="glass-card rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">Adicionar Usuário</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="bg-white/5 border-white/10 h-9 text-sm" />
            <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="bg-white/5 border-white/10 h-9 text-sm" />
            <Input placeholder="Senha" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="bg-white/5 border-white/10 h-9 text-sm" />
            <Select value={form.role} onValueChange={(v: string | null) => setForm(f => ({ ...f, role: v ?? f.role }))}>
              <SelectTrigger className="bg-white/5 border-white/10 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1e293b] border-white/10">
                <SelectItem value="operator">Operador</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addUser} className="w-full bg-red-600 hover:bg-red-500 cursor-pointer h-9 text-sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}
