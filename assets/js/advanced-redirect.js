const fragment = location.hash.replace(/^#/, '');
const route = fragment === 'raw-lab' || fragment === 'command-log'
  ? `#advanced/${fragment}`
  : '#advanced';
const target = `index.html${route}`;
document.querySelector('#advanced-link').href = target;
location.replace(target);
