const path = require('node:path');
const redirects = require('../config/doc-redirects.json');

/** Keep published URLs working after consolidating duplicate documents. */
module.exports = function docRedirects(context) {
  return {
    name: 'zlua-doc-redirects',
    async contentLoaded({actions}) {
      const {currentLocale, defaultLocale} = context.i18n;
      const prefix = currentLocale === defaultLocale ? '' : `/${currentLocale}`;
      for (const [from, to] of Object.entries(redirects)) {
        const target = `${prefix}/docs/${to}/`;
        const data = await actions.createData(
          `${from.replaceAll('/', '-')}.json`,
          JSON.stringify({target}),
        );
        actions.addRoute({
          path: `${prefix}/docs/${from}/`,
          exact: true,
          component: path.resolve(__dirname, '../src/components/DocRedirect/index.tsx'),
          modules: {data},
        });
      }
    },
  };
};
