import * as yaml from 'js-yaml';
import { SystemMap, SystemMapService } from '../types';
import { getCached, setCached } from '../services/redis';
import { logger } from './logger';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const SYSTEM_MAP_CACHE_KEY = 'system_map:current';
const SYSTEM_MAP_TTL = 300; // 5 minutes

export async function loadSystemMap(path?: string): Promise<SystemMap> {
  const mapPath = path || process.env.SYSTEM_MAP_PATH || './system-map.yaml';
  
  try {
    if (!existsSync(mapPath)) {
      logger.warn('SYSTEM_MAP_NOT_FOUND', { path: mapPath });
      return getDefaultSystemMap();
    }

    const content = await readFile(mapPath, 'utf-8');
    const map = yaml.load(content) as SystemMap;
    
    // Validate structure
    if (!map.services || typeof map.services !== 'object') {
      throw new Error('Invalid system map: missing services');
    }

    // Cache the loaded map
    await setCached(SYSTEM_MAP_CACHE_KEY, map, SYSTEM_MAP_TTL);
    
    logger.info('SYSTEM_MAP_LOADED', {
      path: mapPath,
      serviceCount: Object.keys(map.services).length
    });

    return map;
  } catch (error) {
    logger.error('SYSTEM_MAP_LOAD_ERROR', error as Error, { path: mapPath });
    return getDefaultSystemMap();
  }
}

export async function getSystemMap(): Promise<SystemMap> {
  // Try cache first
  const cached = await getCached<SystemMap>(SYSTEM_MAP_CACHE_KEY);
  if (cached) {
    return cached;
  }

  // Load from file
  return loadSystemMap();
}

export function getDefaultSystemMap(): SystemMap {
  return {
    version: '1.0',
    updated_at: new Date().toISOString(),
    services: {
      TracePulse: {
        description: 'Main debugging service',
        file: 'packages/tracepulse/src/server.ts',
        functions: ['processEvents', 'analyzeEvent'],
        depends_on: ['Redis', 'GitHub', 'Slack', 'OpenAI']
      },
      DebugQueue: {
        description: 'Event logging library',
        file: 'packages/debug-queue/src/index.ts',
        functions: ['log', 'error', 'warn'],
        depends_on: ['TracePulse']
      }
    }
  };
}

export function findServiceDependencies(
  serviceName: string, 
  systemMap: SystemMap, 
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(serviceName)) {
    return [];
  }

  visited.add(serviceName);
  const service = systemMap.services[serviceName];
  
  if (!service || !service.depends_on) {
    return [];
  }

  const dependencies: string[] = [...service.depends_on];
  
  // Recursively find transitive dependencies
  for (const dep of service.depends_on) {
    dependencies.push(...findServiceDependencies(dep, systemMap, visited));
  }

  return [...new Set(dependencies)];
}

export function findDependents(
  serviceName: string,
  systemMap: SystemMap
): string[] {
  const dependents: string[] = [];
  
  for (const [name, service] of Object.entries(systemMap.services)) {
    if (service.depends_on?.includes(serviceName)) {
      dependents.push(name);
    }
  }
  
  return dependents;
}

export function analyzeImpact(
  affectedService: string,
  systemMap: SystemMap
): {
  directDependents: string[];
  allDependents: string[];
  dependencies: string[];
} {
  const directDependents = findDependents(affectedService, systemMap);
  const dependencies = findServiceDependencies(affectedService, systemMap);
  
  // Find all transitive dependents
  const allDependents = new Set<string>(directDependents);
  const queue = [...directDependents];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const deps = findDependents(current, systemMap);
    
    for (const dep of deps) {
      if (!allDependents.has(dep)) {
        allDependents.add(dep);
        queue.push(dep);
      }
    }
  }
  
  return {
    directDependents,
    allDependents: Array.from(allDependents),
    dependencies
  };
}