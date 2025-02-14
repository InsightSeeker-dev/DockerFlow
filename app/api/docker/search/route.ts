import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = searchParams.get('term');

  if (!term) {
    return NextResponse.json(
      { error: 'Search term is required' },
      { status: 400 }
    );
  }

  try {
    const searchUrl = `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(term)}`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch from Docker Hub');
    }

    const data = await response.json();

    // Transformer les résultats pour correspondre à notre interface
    const results = data.results.map((result: any) => ({
      name: result.repo_name,
      description: result.short_description || result.description || 'No description available',
      stars: result.star_count,
      official: result.is_official,
      automated: result.is_automated,
      pulls: result.pull_count
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching Docker Hub:', error);
    return NextResponse.json(
      { error: 'Failed to search Docker Hub' },
      { status: 500 }
    );
  }
}