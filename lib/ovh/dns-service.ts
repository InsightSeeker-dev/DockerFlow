import ovh from 'ovh';
import { env } from '@/env.mjs';

const ovhClient = ovh({
  appKey: env.OVH_APPLICATION_KEY,
  appSecret: env.OVH_APPLICATION_SECRET,
  consumerKey: env.OVH_CONSUMER_KEY,
  endpoint: env.OVH_ENDPOINT,
});

interface DNSRecord {
  fieldType: string;
  id: number;
  subDomain?: string;
  target: string;
  ttl: number;
}

export class OVHDNSService {
  private domain: string;

  constructor() {
    this.domain = env.DOMAIN_NAME;
  }

  async addSubdomain(subdomain: string): Promise<void> {
    try {
      // Vérifier si l'enregistrement existe déjà
      const records = await ovhClient.request('GET', `/domain/zone/${this.domain}/record`, {
        fieldType: 'A',
        subDomain: subdomain,
      });

      if ((records as number[]).length > 0) {
        throw new Error(`Le sous-domaine ${subdomain} existe déjà`);
      }

      // Créer l'enregistrement A pour pointer vers votre serveur
      await ovhClient.request('POST', `/domain/zone/${this.domain}/record`, {
        fieldType: 'A',
        subDomain: subdomain,
        target: env.SERVER_IP,
        ttl: 3600,
      });

      // Appliquer les changements
      await ovhClient.request('POST', `/domain/zone/${this.domain}/refresh`);
    } catch (error) {
      console.error('Erreur lors de la création du sous-domaine:', error);
      throw error;
    }
  }

  async removeSubdomain(subdomain: string): Promise<void> {
    try {
      // Trouver l'ID de l'enregistrement
      const records = await ovhClient.request('GET', `/domain/zone/${this.domain}/record`, {
        fieldType: 'A',
        subDomain: subdomain,
      });

      if ((records as number[]).length === 0) {
        return; // Le sous-domaine n'existe pas, rien à faire
      }

      // Supprimer l'enregistrement
      for (const recordId of (records as number[])) {
        await ovhClient.request('DELETE', `/domain/zone/${this.domain}/record/${recordId}`);
      }

      // Appliquer les changements
      await ovhClient.request('POST', `/domain/zone/${this.domain}/refresh`);
    } catch (error) {
      console.error('Erreur lors de la suppression du sous-domaine:', error);
      throw error;
    }
  }
}

export const ovhDNSService = new OVHDNSService();
