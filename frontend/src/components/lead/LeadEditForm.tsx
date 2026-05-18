'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import type { Lead } from '@/components/kanban/LeadCard';

const leadSchema = z.object({
  name: z.string().optional(),
  contactPhone: z.string().optional(),
  city: z.string().optional(),
  creditStatus: z.string().optional(),
  paymentMethod: z.string().optional(),
  vehicleUrl: z.string().url().optional().or(z.literal('')),
});

type LeadFormData = z.infer<typeof leadSchema>;

export function LeadEditForm({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, formState: { isSubmitting } } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: lead.name ?? '',
      contactPhone: lead.contactPhone ?? '',
      city: lead.city ?? '',
      creditStatus: lead.creditStatus ?? '',
      paymentMethod: lead.paymentMethod ?? '',
      vehicleUrl: lead.vehicleUrl ?? '',
    },
  });

  const onSubmit = async (data: LeadFormData) => {
    await api.patch(`/leads/${lead.id}`, data);
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['lead', lead.id] });
  };

  const inputClass = "bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 focus:border-red-500/50 h-9 text-sm";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-neutral-500 dark:text-neutral-400">Nome</Label>
        <Input {...register('name')} className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-neutral-500 dark:text-neutral-400">Telefone / WhatsApp</Label>
        <Input {...register('contactPhone')} className={inputClass} placeholder="5531999999999" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-neutral-500 dark:text-neutral-400">Cidade</Label>
        <Input {...register('city')} className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-neutral-500 dark:text-neutral-400">Status de Crédito</Label>
        <Select defaultValue={lead.creditStatus ?? ''} onValueChange={v => v && setValue('creditStatus', v)}>
          <SelectTrigger className={inputClass}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent className="bg-white dark:bg-[#1e293b] border-neutral-200 dark:border-white/10">
            <SelectItem value="Aprovado">Aprovado</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
            <SelectItem value="Reprovado">Reprovado</SelectItem>
            <SelectItem value="Nao informado">Não informado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-neutral-500 dark:text-neutral-400">Forma de Pagamento</Label>
        <Select defaultValue={lead.paymentMethod ?? ''} onValueChange={v => v && setValue('paymentMethod', v)}>
          <SelectTrigger className={inputClass}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent className="bg-white dark:bg-[#1e293b] border-neutral-200 dark:border-white/10">
            <SelectItem value="Financiamento">Financiamento</SelectItem>
            <SelectItem value="A vista">À vista</SelectItem>
            <SelectItem value="Consorcio">Consórcio</SelectItem>
            <SelectItem value="Nao informado">Não informado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-neutral-500 dark:text-neutral-400">URL do Veículo</Label>
        <Input {...register('vehicleUrl')} className={inputClass} placeholder="https://autoscar.com.br/..." />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-500 cursor-pointer h-9 text-sm mt-6">
        {isSubmitting ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Salvando...</> : <><Save className="h-3.5 w-3.5 mr-1.5" /> Salvar alterações</>}
      </Button>
    </form>
  );
}
