import { AppService } from './app.service';

describe('AppService', () => {
  it('returns the default API message', () => {
    const service = new AppService();

    expect(service.getData()).toEqual({ message: 'Hello API' });
  });
});
