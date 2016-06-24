import route from './server/route';

export default function (kibana) {
  return new kibana.Plugin({
    init(server, options) {
      // Add server routes and initalize the plugin here
      route(server);
    }
  });
};