import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Endpoint de prueba (Healthcheck)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API de Senda funcionando correctamente' });
});

// --- Endpoints de Diario y Ánimo (Ejemplos) ---

app.post('/api/mood', async (req, res) => {
  try {
    const { userId, score, emotions, notes } = req.body;
    const newEntry = await prisma.moodEntry.create({
      data: {
        userId,
        score,
        emotions,
        notes
      }
    });
    res.status(201).json(newEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error guardando el registro de ánimo' });
  }
});

app.get('/api/mood/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const entries = await prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Error consultando los registros' });
  }
});

// --- Integración Mock de NOVA (IA) ---

import OpenAI from 'openai';
import { NOVA_SYSTEM_PROMPT } from './prompts';

// ... (El resto permanece igual hasta el endpoint de chat) ...

app.post('/api/chat/nova', async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    // Filtro de crisis básico
    const crisisKeywords = ['suicidio', 'matarme', 'morir', 'daño', 'abuso'];
    const isCrisis = crisisKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    if (isCrisis) {
      return res.json({
        role: 'assistant',
        content: "Lo que me cuentas es muy importante y doloroso. Como soy una inteligencia artificial, no puedo darte el nivel de apoyo que mereces en este momento. Por favor, utiliza el botón 'Necesito ayuda ahora' en la pantalla o contacta a un servicio de emergencias local."
      });
    }

    if (process.env.OPENAI_API_KEY) {
      // Llamada real a OpenAI si existe la clave en .env
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: NOVA_SYSTEM_PROMPT },
          { role: "user", content: message }
        ],
        max_tokens: 200,
        temperature: 0.5,
      });

      const responseText = completion.choices[0]?.message?.content || "No pude procesar tu mensaje.";
      return res.json({ role: 'assistant', content: responseText });

    } else {
      // Simularemos una respuesta por ahora si no hay API_KEY:
      const mockResponse = "(Simulación, sin API Key) Entiendo cómo te sientes. ¿Qué crees que podrías hacer hoy por ti mismo para dar un pequeño paso?";
      return res.json({ role: 'assistant', content: mockResponse });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error comunicando con NOVA' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de Senda corriendo en http://localhost:${PORT}`);
});
