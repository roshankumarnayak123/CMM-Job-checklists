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

export function useSubmissionsByChecklist(checklistId, limitCount = 500) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!checklistId) {
      setSubmissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = firebaseService.subscribeToSubmissionsByChecklist(
      checklistId,
      (data) => {
        setSubmissions(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching submissions by checklist:", error);
        setLoading(false);
      },
      limitCount
    );
    return () => unsubscribe();
  }, [checklistId, limitCount]);

  return { data: submissions, loading };
}

export function useTokensByChecklist(checklistId) {
  const [pendingTokens, setPendingTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!checklistId) {
      setPendingTokens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = firebaseService.subscribeToTokensByChecklist(
      checklistId,
      (data) => {
        setPendingTokens(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching review tokens by checklist:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [checklistId]);

  return { data: pendingTokens, loading };
}

export function useAreas() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = firebaseService.subscribeToAreas(
      (data) => {
        setAreas(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching areas:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return { data: areas, loading };
}
