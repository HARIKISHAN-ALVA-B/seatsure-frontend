import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Link, useNavigate } from 'react-router-dom';

const Home = () => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const fetchEvents = async () => {
            // Assuming you have an 'events' table with an 'id' and 'name'
            const { data } = await supabase.from('events').select('*');
            if (data) setEvents(data);
        };
        fetchEvents();
    }, []);

    return (
        <div style={{ padding: '20px' }}>
            <h1>Upcoming Events</h1>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {events.map(event => (
                    <div key={event.id} style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', minWidth: '200px' }}>
                        <h3>{event.name || `Event #${event.title}`}</h3>
                        {/* This dynamically routes them to the Seat Map! */}
                        <Link to={`/events/${event.id}`} style={{ display: 'inline-block', marginTop: '10px', padding: '10px', backgroundColor: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                            View Seats
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const navigate = useNavigate(); // Initialize the hook

    const handleLogin = async (e) => {
        e.preventDefault(); // Stop the form from refreshing the page
        
        const { error } = await supabase.auth.signInWithPassword({
            email: email, 
            password: password
        });

        if (error) {
            alert(error.message);
        } else {
            // Success! Redirect them.
            navigate('/');
        }
    };

return(
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', margin: '20px auto' }}>
            
            <input 
                type="email" 
                placeholder="Email"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                style={{ padding: '10px' }}
            />
            
            <input 
                type="password" 
                placeholder="Password"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                style={{ padding: '10px' }}
            />
            
            <button type='submit' style={{ padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none' }}>
                Login
            </button>
            
        </form>
    );
};
const Navbar = () => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    // Check auth status on load
    useEffect(() => {
        const checkUser = async () => {
            const { data } = await supabase.auth.getUser();
            setUser(data.user);
        };
        checkUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/'; // Force a hard reload to clear all state
    };

    return (
        <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 30px', backgroundColor: '#1e293b', color: 'white' }}>
            <Link to="/" style={{ color: 'white', textDecoration: 'none', fontSize: '20px', fontWeight: 'bold' }}>
                🎟️ SeatSure
            </Link>
            
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                {user ? (
                    <>
                        <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none' }}>My Tickets</Link>
                        <button onClick={handleLogout} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                            Logout
                        </button>
                    </>
                ) : (
                    <Link to="/login" style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold' }}>Login</Link>
                )}
            </div>
        </nav>
    );
};

const EventDetail = () => {
    const { id } = useParams();
     // 'id' now holds your event UUID
     // useState(initialValue) returns an array: [currentData, functionToUpdateData]
    const [seats, setSeats] = useState([]);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [isCheckoutMode, setIsCheckoutMode] = useState(false);

    const navigate = useNavigate();

     useEffect(() => {
        const fetchSeats = async () => {
              const { data, error } = await supabase
                  // Relational query: Fetch event seats AND their physical seat details
                  .from('event_seats')
                  .select(`
                      *,
                      seats ( row_label, seat_number, category )
                  `)
                  .eq('event_id', id);

              if (data) setSeats(data);

            if (error) {
                console.error("Fetch failed:", error.message);
            }
          };

          fetchSeats();
      }, [id]);

      const toggleSeat = (seat) => {
          // 1. Guard clause: Ignore clicks on unavailable seats
          if (seat.status !== 'available') return;

          // 2. Check if the seat is already in our selection array
          // (Assuming we are storing just the seat IDs in the array for simplicity)
          if (selectedSeats.includes(seat.id)) {
              // If it's already selected, filter it OUT
              setSelectedSeats(selectedSeats.filter(id => id !== seat.id));
          } else {
              // If it's not selected, spread the existing array and add the new ID IN
              setSelectedSeats([...selectedSeats, seat.id]);
          }
      };
      // This will recalculate the grouping every time the 'seats' state updates
      const groupedSeats = seats.reduce((dictionary, currentSeat) => {
          
          // 1. Extract the row label from the nested Supabase data
          const row = currentSeat.seats.row_label;

          // 2. If this row doesn't exist in our dictionary yet, initialize it as an empty array
          if (!dictionary[row]) {
              dictionary[row] = [];
          }

          // 3. Push the entire currentSeat object into that row's array
          dictionary[row].push(currentSeat);

          // 4. Return the dictionary for the next iteration of the loop
          return dictionary;
          
      }, {}); // We start with a completely empty object
      const calculateTotal = () => {
        return selectedSeats.reduce((total, selectedId) => {
            const seat = seats.find(s => s.id === selectedId);
            // Uses real price, falls back to 0 if your DB is missing the price
            return total + (seat?.price || 0); 
        }, 0);
    };

      const handleCheckout = async () => {
        const { data: authData } = await supabase.auth.getUser();
        
        if (!authData.user) {
            alert("You must be logged in to reserve seats!");
            navigate("/login");
            return; 
        }
          try {
              const response = await fetch(`${import.meta.env.VITE_API_URL}/events/${id}/lock`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ seatIds: selectedSeats })
              });

              const data = await response.json();

              if (!response.ok) {
                  // This catches the 409 error you wrote in Problem 7!
                  alert(data.error || "Something went wrong.");
                  return;
              }

              alert("Seats successfully locked for 5 minutes!");
              console.log("Locked Seats:", data);
              
              setIsCheckoutMode(true);// Next step: Redirect to payment page...

          } catch (error) {
              console.error("Network error:", error);
          }
      };
      const cancelCheckout = async () => {
            try {
                await supabase
                    .from('event_seats')
                    .update({ status: 'available' })
                    .in('id', selectedSeats);
                
                setIsCheckoutMode(false);
                setSelectedSeats([]);
                window.location.reload();
            } catch (error) {
                console.error("Failed to release seats:", error);
            }
        };

      const processPayment = async (e) => {
        e.preventDefault(); 
        
        // 1. Get the REAL User ID dynamically from the browser's local session
        const { data: authData } = await supabase.auth.getUser();
        const UserId = authData.user?.id;

        if (!UserId) {
            alert("Authentication Error: You must be logged in to buy tickets.");
            return;
        }

        // 2. Calculate the REAL Total Price dynamically from your React state
        const TotalAmount = calculateTotal();

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: UserId, // Using the real ID
                    totalAmount: TotalAmount, // Using the real price
                    seatIds: selectedSeats
                })
            });

            if (response.ok) {
                alert(`Payment Successful! $${TotalAmount} charged. Tickets Booked.`);
                window.location.reload(); 
            } else {
                const errorData = await response.json();
                alert("Checkout Failed: " + errorData.error);
            }
        } catch (error) {
            console.error("Payment failed", error);
        }
    };

  return (
    <div>
    {isCheckoutMode ? (
            // --- VIEW 1: THE CHECKOUT FORM ---
            <div className="checkout-container">
                <h2>Complete Your Payment</h2>
                <p>Total: ${calculateTotal()}</p>
                <form onSubmit={processPayment}>
                    <input type="text" placeholder="Card Number" required />
                    <input type="text" placeholder="MM/YY" required />
                    <input type="text" placeholder="CVC" required />
                    <button type="submit">Pay Now</button>
                    <button 
                        type="button" 
                        onClick={cancelCheckout} 
                        style={{ padding: '10px', backgroundColor: '#ef4444', color: 'white', marginLeft: '10px' }}
                    >
                        Cancel
                    </button>
                </form>
            </div>
        ) : (
      <div>
        
          <h1>Seat Map</h1>
          {Object.keys(groupedSeats).sort().map(rowLabel => (
              <div key={rowLabel} className="row-container">
                  {/* Render your row label and seats here */}
                  <span>{rowLabel}</span>
                  {groupedSeats[rowLabel]
                  .sort((a, b) => a.seats.seat_number - b.seats.seat_number)
                  .map(seat => (
                    <button 
                        key={seat.id}
                        onClick={() => toggleSeat(seat)}
                        style={{
                            // Inside your style object:
                            backgroundColor: selectedSeats.includes(seat.id) 
                                ? '#60a5fa' // Blue (Selected!)
                                : seat.status === 'available' 
                                    ? '#4ade80' // Green (Available)
                                    : '#d1d5db', // Gray (Unavailable),
                            padding: '10px',
                            margin: '2px',
                            cursor: seat.status === 'available' ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {seat.seats.seat_number}
                    </button>
              ))}
              </div>
          ))}
          
          {selectedSeats.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                  <button 
                      onClick={handleCheckout}
                      style={{ padding: '15px 30px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px' }}
                  >
                      Lock {selectedSeats.length} Seats & Checkout
                  </button>
              </div>
          )}
      </div>
        )}
    </div>
  );

};

const Dashboard = () => {
    const [myBookings, setMyBookings] = useState([]);
    useEffect(() => {
            const fetchMyTickets = async () => {
                // 1. Get the logged-in user
                const { data: authData } = await supabase.auth.getUser();
                const userId = authData.user?.id;

                if (!userId) return;

                // 2. The Deep Relational Fetch
                const { data, error } = await supabase
                    .from('bookings')
                    .select(`
                        id,
                        total_amount,
                        status,
                        created_at,
                        booking_seats (
                            event_seats (
                                seats ( row_label, seat_number )
                            )
                        )
                    `)
                    .eq('user_id', userId);

                if (data) {
                    setMyBookings(data);
                }
            };
            fetchMyTickets();
    }, []);

    return (
            <div style={{ padding: '20px' }}>
                <h1>My Tickets</h1>
                
                {myBookings.map(booking => (
                    <div key={booking.id} style={{ border: '1px solid #ccc', margin: '10px 0', padding: '15px' }}>
                        <h3>Order: {booking.id}</h3>
                        <p>Total Paid: ${booking.total_amount}</p>
                        <p>Status: {booking.status}</p>
                        
                        <h4>Your Seats:</h4>
                        <ul>
                            {booking.booking_seats.map(mapping => (
                                <li key={mapping.event_seats.seats.seat_number}>
                                    Row {mapping.event_seats.seats.row_label}, 
                                    Seat {mapping.event_seats.seats.seat_number}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        );
};

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/dashboard" element = {<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;