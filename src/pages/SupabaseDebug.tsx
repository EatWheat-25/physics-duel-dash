/**
 * Supabase Debug Tool
 * 
 * Use this page to interact with Supabase and debug issues.
 * Navigate to /supabase-debug
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Database, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function SupabaseDebug() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tableName, setTableName] = useState('matches');
  const [query, setQuery] = useState('SELECT * FROM matches LIMIT 10');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const checkTable = async (table: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(table)
        .select('*')
        .limit(10);

      if (err) {
        setError(err.message);
        setResults(null);
      } else {
        setResults({ data, count: data?.length || 0 });
      }
    } catch (err: any) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const checkMatchmakingQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) {
        setError(err.message);
        setResults(null);
      } else {
        setResults({ data, count: data?.length || 0 });
      }
    } catch (err: any) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const checkQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('questions_v2')
        .select('*')
        .limit(10);

      if (err) {
        setError(err.message);
        setResults(null);
      } else {
        setResults({ data, count: data?.length || 0 });
      }
    } catch (err: any) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const checkMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (err) {
        setError(err.message);
        setResults(null);
      } else {
        setResults({ data, count: data?.length || 0 });
      }
    } catch (err: any) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Supabase Debug Tool
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auth Status */}
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Authentication Status</h3>
              {user ? (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  <span>Logged in as: {user.email} ({user.id})</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-500">
                  <XCircle className="w-4 h-4" />
                  <span>Not authenticated</span>
                </div>
              )}
            </div>

            {/* Quick Checks */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button onClick={checkMatches} disabled={loading} variant="outline">
                Check Matches
              </Button>
              <Button onClick={checkMatchmakingQueue} disabled={loading} variant="outline">
                Check Queue
              </Button>
              <Button onClick={checkQuestions} disabled={loading} variant="outline">
                Check Questions
              </Button>
              <Button 
                onClick={() => checkTable(tableName)} 
                disabled={loading} 
                variant="outline"
              >
                Check Table
              </Button>
            </div>

            {/* Custom Table Check */}
            <div className="flex gap-2">
              <Input
                placeholder="Table name (e.g., matches, questions)"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
              <Button onClick={() => checkTable(tableName)} disabled={loading}>
                Query
              </Button>
            </div>

            {/* Results */}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg">
                <div className="flex items-center gap-2 text-red-500 mb-2">
                  <XCircle className="w-4 h-4" />
                  <span className="font-semibold">Error</span>
                </div>
                <pre className="text-sm text-red-400">{error}</pre>
              </div>
            )}

            {results && !loading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-semibold">Found {results.count} rows</span>
                </div>
                <div className="p-4 bg-muted rounded-lg overflow-auto max-h-96">
                  <pre className="text-xs">
                    {JSON.stringify(results.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

