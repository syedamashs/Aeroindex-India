import type { Observation } from './types';
import { getObservations, appendNewObservations } from './generator';

export interface DataSource {
  readonly name: string;
  readonly isLive: boolean;
  fetchObservations(): Observation[];
  simulateUpdate(count: number): Observation[];
}

export class MockAirfareDataSource implements DataSource {
  readonly name = 'MockAirfareDataSource';
  readonly isLive = false;

  fetchObservations(): Observation[] {
    return getObservations();
  }

  simulateUpdate(count: number): Observation[] {
    return appendNewObservations(count);
  }
}

export class LiveAirfareDataSource implements DataSource {
  readonly name = 'LiveAirfareDataSource';
  readonly isLive = true;

  fetchObservations(): Observation[] {
    throw new Error('Live data source not yet configured. Connect a permitted airline/OTA/API feed.');
  }

  simulateUpdate(_count: number): Observation[] {
    throw new Error('Live data source does not support simulated updates.');
  }
}

let _dataSource: DataSource = new MockAirfareDataSource();

export function getDataSource(): DataSource {
  return _dataSource;
}

export function setDataSource(ds: DataSource): void {
  _dataSource = ds;
}
