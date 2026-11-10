import {useEffect, type ReactNode} from 'react';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Translate from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function DocRedirect({data}: {data: {target: string}}): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  useEffect(() => {
    window.location.replace(data.target + window.location.search + window.location.hash);
  }, [data.target]);

  return (
    <Layout title="ZLua Docs">
      <Head>
        <meta httpEquiv="refresh" content={`0;url=${data.target}`} />
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href={new URL(data.target, siteConfig.url).href} />
      </Head>
      <main className="container margin-vert--lg">
        <Link to={data.target}>
          <Translate id="docs.redirect.continue">Continue to the updated document</Translate>
        </Link>
      </main>
    </Layout>
  );
}
