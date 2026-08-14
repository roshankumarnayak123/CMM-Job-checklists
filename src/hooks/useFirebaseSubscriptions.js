import { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';

export function useSubmissions(limitCount = 20) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    setLoading(true);
    const unsubscribe = firebaseService.subscribeToSubmissions(
      (data) => {
        setSubmissions(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching submissions:", error);
        setLoading(false);
      },
      limitCount
    );
    return () => unsubscribe();
  }, [limitCount]);

  return { data: submissions, loading };
}

export function usePendingTokens() {
  const [pendingTokens, setPendingTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = firebaseService.subscribeToTokens(
      (data) => {
        setPendingTokens(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching review tokens:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { data: pendingTokens, loading };
}
