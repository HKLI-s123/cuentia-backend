import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import * as fs from 'fs';

@Injectable()
export class AiService {
  private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY});
  private readonly logger = new Logger(AiService.name);

  async esComprobante(rutaImagen: string): Promise<boolean> {
    const base64Image = fs.readFileSync(rutaImagen, 'base64');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '¿La imagen que te muestro corresponde a un ticket de compra o comprobante de compra? Responde solo con "Sí" o "No"' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      max_tokens: 10,
    });

    const respuesta = response.choices[0].message?.content?.trim()?.toLowerCase() ?? '';
    console.log(respuesta);
    return respuesta.startsWith('sí');
  }

  async extraerDatosComprobante(rutaImagen: string) {
    const base64Image = fs.readFileSync(rutaImagen, 'base64');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analiza esta imagen de un comprobante de pago y responde SOLO un JSON válido con estos campos:
              - Nombre_del_emisor_del_ticket
              - rfc
              - Fecha
              - Numero_de_ticket
              - Total
              - Iva8
              - Iva16
              Si algún dato no se encuentra, usa null.`,
            },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      max_tokens: 500,
    });

    const content = response.choices[0].message?.content;
    
    if (!content) {
      this.logger.error('La respuesta de OpenAI no contiene contenido válido:', response);
      throw new Error('Respuesta vacía de OpenAI');
    }
    
    try {
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Error al parsear JSON:', error);
      throw new Error('Respuesta inválida de OpenAI');
    }
  }

  async esComprobanteDigital(rutaImagen: string): Promise<boolean> {
    const base64Image = fs.readFileSync(rutaImagen, 'base64');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '¿La imagen es un comprobante digital bancario (transferencia, SPEI, depósito, etc.)? Responde solo con "Sí" o "No".',
            },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      max_tokens: 10,
    });

    const respuesta = response.choices[0].message?.content?.trim()?.toLowerCase() ?? '';
    return respuesta.startsWith('sí');
  }

  async extraerDatosComprobanteDigital(rutaImagen: string) {
    const base64Image = fs.readFileSync(rutaImagen, 'base64');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analiza esta imagen de un comprobante digital bancario y devuelve un JSON con los campos:
              - banco_emisor
              - banco_receptor
              - titular_emisor
              - titular_receptor
              - fecha_operacion
              - monto
              - clave_rastreo
              - folio_interno
              - tipo_operacion
              - moneda
              - concepto_o_referencia
              Usa null si falta algo.`,
            },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      max_tokens: 800,
    });

    const content = response.choices[0].message?.content;

    if (!content) throw new Error('Respuesta vacía de OpenAI');

    try {
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Error al parsear JSON:', error);
      throw new Error('Respuesta inválida de OpenAI');
    }
  }

}
