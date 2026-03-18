import { z } from 'zod';

export const vehicleSchema = z.object({
  model: z.string().min(1, 'Vehicle model is required'),
  year: z.string().min(1, 'Year is required'),
  km: z.string().min(1, 'Mileage is required'),
  price: z.string().min(1, 'Price is required'),
  photos: z.array(z.string().url()).min(1, 'At least 1 photo URL is required'),
  color: z.string().optional(),
  fuel: z.string().optional(),
  transmission: z.string().optional(),
  plate: z.string().optional(),
  city: z.string().optional(),
});

export type Vehicle = z.infer<typeof vehicleSchema>;
