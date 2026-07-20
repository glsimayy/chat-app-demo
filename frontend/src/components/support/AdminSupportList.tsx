import { useEffect, useState } from 'react';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  priority: number;
}

export const AdminSupportList = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // İleride buraya backend'den veri çeken fetch komutu gelecek
   
    console.log("Talepler burada listelenecek.");
    setLoading(false);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h3>Gelen Destek Talepleri</h3>

      {loading && <p>Yükleniyor...</p>}

      {!loading && tickets.length === 0 && (
        <p>Henüz gelen bir talep yok.</p>
      )}

      {!loading && tickets.length > 0 && (
        <ul>
          {tickets.map((ticket) => (
            <li key={ticket.id} style={{ marginBottom: '10px' }}>
              <strong>{ticket.subject}</strong> (Öncelik: {ticket.priority})
              <br />
              {ticket.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};