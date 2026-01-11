import { useEffect, useState } from 'react';

interface WordPressPage {
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export default function WordPressPage({ slug }: { slug: string }) {
  const [page, setPage] = useState<WordPressPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const response = await fetch(
          `https://admin.adocshub.com/wp-json/wp/v2/pages?slug=${slug}`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          setPage(data[0]);
          // Track page view in Google Analytics
          if (window.gtag) {
            window.gtag('event', 'page_view', {
              page_title: data[0].title.rendered,
              page_location: window.location.href,
              page_path: window.location.pathname
            });
          }
        } else {
          setError('Page not found');
        }
      } catch (err) {
        setError('Failed to load page');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [slug]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!page) return <div>Page not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6" 
          dangerouslySetInnerHTML={{ __html: page.title.rendered }} 
      />
      <div className="prose prose-lg max-w-none"
           dangerouslySetInnerHTML={{ __html: page.content.rendered }}
      />
    </div>
  );
} 