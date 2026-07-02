import { App } from '@/App';

describe('App', () => {
  it('renders the router shell', () => {
    const element = App();

    expect(element.type.name).toBe('AppRouter');
  });
});
