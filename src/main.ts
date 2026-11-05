import './styles/main.css';
import { App } from './app/App';

const app = new App();
app.run().catch((err: unknown) => {
  // last line of defence: never leave a blank page
  console.error(err);
  document.getElementById('loader')?.setAttribute('hidden', '');
  document.getElementById('fallback')?.removeAttribute('hidden');
});
