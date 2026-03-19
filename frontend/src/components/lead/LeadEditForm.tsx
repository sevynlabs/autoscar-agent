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
import type { Lead } from '@/components/kanban/LeadCard';

const leadSchema = z.object({
  name: z.string().optional(),
  city: z.string().optional(),
  creditStatus: z.string().optional(),
  paymentMethod: z.string().optional(),
  vehicleUrl: z.string().url().optional().or(z.literal('')),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadEditFormProps {
  lead: Lead;
}

export function LeadEditForm({ lead }: LeadEditFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, formState: { isSubmitting } } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: lead.name ?? '',
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-2">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...register('name')} />
      </div>

      <div>
        <Label htmlFor="city">Cidade</Label>
        <Input id="city" {...register('city')} />
      </div>

      <div>
        <Label>Status de Crédito</Label>
        <Select
          defaultValue={lead.creditStatus ?? ''}
          onValueChange={v => v && setValue('creditStatus', v)}
        >
          <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Aprovado">Aprovado</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
            <SelectItem value="Reprovado">Reprovado</SelectItem>
            <SelectItem value="Nao informado">Não informado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Forma de Pagamento</Label>
        <Select
          defaultValue={lead.paymentMethod ?? ''}
          onValueChange={v => v && setValue('paymentMethod', v)}
        >
          <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Financiamento">Financiamento</SelectItem>
            <SelectItem value="A vista">À vista</SelectItem>
            <SelectItem value="Consorcio">Consórcio</SelectItem>
            <SelectItem value="Nao informado">Não informado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="vehicleUrl">URL do Veículo</Label>
        <Input id="vehicleUrl" {...register('vehicleUrl')} />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  );
}
