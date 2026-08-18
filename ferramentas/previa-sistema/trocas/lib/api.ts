/**
 * Cliente HTTP da PREVIA estatica.
 *
 * Mesma instancia axios do produto, com um detalhe: o adaptador nao vai a
 * rede, responde a partir da base gravada (ver `demo-api.ts`). Todo o resto do
 * codigo continua chamando `api.get('/conversations')` sem saber a diferenca.
 */

import axios from 'axios';
import { adaptadorDemo } from './demo-api';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.defaults.adapter = adaptadorDemo;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const message = error.response?.data?.message || error.message;
    const err = new Error(Array.isArray(message) ? message[0] : message);
    (err as { status?: number }).status = error.response?.status;
    return Promise.reject(err);
  },
);
