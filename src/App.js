import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs, writeBatch } from 'firebase/firestore';
//                                                              ^^^^^^^^^^ Make sure writeBatch is imported

// --- Firebase Configuration ---
// IMPORTANT: Replace these with your actual Firebase project configuration
// Get this from your Firebase project settings (Project settings > Your apps > Web app)
const firebaseConfig = {
  apiKey: "AIzaSyB9U6piX44T8PFdKIRvkMXCafdd5uBTD4E",
  authDomain: "library-booking-883ef.firebaseapp.com",
  projectId: "library-booking-883ef",
  storageBucket: "library-booking-883ef.firebasestorage.app",
  messagingSenderId: "913026864882",
  appId: "1:913026864882:web:fb8d65477754e21f28626b",
  measurementId: "G-8ELHRR2YEX"
};


// Also define appId directly from the config for consistency
const appId = "1:913026864882:web:fb8d65477754e21f28626b"; // Use your actual appId from the config

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Default Room Data (to be added if rooms collection is empty) ---
const defaultRooms = [
  { id: 'room-1', name: 'Conference Room 1', capacity: 10, amenities: ['TV Screen', 'Whiteboard'], description: 'Spacious room for large meetings.', img: 'https://via.placeholder.com/400x250/C7E2E0/000000?text=Room+1' },
  { id: 'room-2', name: 'Conference Room 2', capacity: 10, amenities: ['Large Table & Chairs'], description: 'Ideal for small team discussions.', img: 'https://via.placeholder.com/400x250/D1E8D0/000000?text=Room+2' },
];

// --- Utility Functions ---
const formatDateForDisplay = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatTimeForDisplay = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const combineDateTime = (date, time) => {
  const d = new Date(date);
  const t = new Date(`1970-01-01T${time}`);
  d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  return d;
};

// --- Components ---

function Login({ onLogin, onCreateAccount }) {
  const [schoolId, setSchoolId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const email = `${schoolId}@ubian.com`; // Placeholder email for Firebase Auth
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin(schoolId);
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid School ID or Password. Please try again.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Login</h2>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="schoolId">
              School ID
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="schoolId"
              type="text"
              placeholder="e.g., 2200647"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs italic mb-4 text-center">{error}</p>}
          <div className="flex flex-col gap-4">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit"
            >
              Sign In
            </button>
            <button
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="button"
              onClick={onCreateAccount}
            >
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateAccount({ onBackToLogin }) {
  const [schoolId, setSchoolId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
    }

    const email = `${schoolId}@ubian.com`; // Placeholder email
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Create user profile in Firestore
      await setDoc(doc(db, `artifacts/${appId}/public/data/users`, schoolId), {
        schoolId: schoolId,
        email: email,
        role: 'patron', // Default role
        createdAt: new Date()
      });
      setSuccess("Account created successfully! You can now log in.");
      setSchoolId('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error("Account creation error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This School ID is already registered.");
      } else {
        setError("Failed to create account. Please try again.");
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Create Account</h2>
        <form onSubmit={handleCreateAccount}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="newSchoolId">
              School ID
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="newSchoolId"
              type="text"
              placeholder="e.g., 2200647"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="newPassword">
              Password
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="newPassword"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              id="confirmPassword"
              type="password"
              placeholder="********"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs italic mb-4 text-center">{error}</p>}
          {success && <p className="text-green-500 text-xs italic mb-4 text-center">{success}</p>}
          <div className="flex flex-col gap-4">
            <button
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit"
            >
              Create Account
            </button>
            <button
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="button"
              onClick={onBackToLogin}
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RoomCard({ room, onSelectRoom }) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-300">
      <img src={room.img} alt={room.name} className="w-full h-40 object-cover" />
      <div className="p-4">
        <h3 className="text-xl font-bold mb-2 text-gray-800">{room.name}</h3>
        <p className="text-gray-600 text-sm mb-2">Capacity: {room.capacity}</p>
        <p className="text-gray-600 text-sm mb-2">Amenities: {room.amenities.join(', ')}</p>
        <p className="text-gray-700 text-sm mb-4">{room.description}</p>
        <button
          onClick={() => onSelectRoom(room)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline w-full"
        >
          View & Book
        </button>
      </div>
    </div>
  );
}

function RoomBooking({ user, onLogout, selectedRoom, onBackToRooms }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState(''); // 'success' or 'error'

  const fetchBookings = useCallback(async () => {
    if (!selectedRoom || !selectedDate) {
      setBookings([]);
      return;
    }
    setIsLoading(true);
    setFeedbackMessage('');
    try {
      const dateKey = new Date(selectedDate).toISOString().split('T')[0]; // YYYY-MM-DD
      const docRef = doc(db, `artifacts/${appId}/public/data/bookings`, dateKey);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const roomBookings = docSnap.data()[selectedRoom.id] || [];
        setBookings(roomBookings);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      setFeedbackMessage("Failed to load bookings. Please try again.");
      setFeedbackType('error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoom, selectedDate]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleBookRoom = async (e) => {
    e.preventDefault();
    setFeedbackMessage('');
    setFeedbackType('');

    if (!selectedDate || !selectedTime || !purpose) {
      setFeedbackMessage('Please fill in all booking details.');
      setFeedbackType('error');
      return;
    }

    const bookingDateTime = combineDateTime(selectedDate, selectedTime);
    if (bookingDateTime < new Date()) {
        setFeedbackMessage('Cannot book a time in the past.');
        setFeedbackType('error');
        return;
    }

    const dateKey = new Date(selectedDate).toISOString().split('T')[0]; // YYYY-MM-DD
    const newBooking = {
      id: uuidv4(),
      schoolId: user.schoolId,
      roomName: selectedRoom.name,
      roomId: selectedRoom.id,
      date: new Date(selectedDate).toISOString(), // Store as ISO string
      time: selectedTime,
      purpose: purpose,
      status: 'pending', // pending, approved, rejected
      bookedAt: new Date().toISOString(),
    };

    setIsLoading(true);
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/bookings`, dateKey);
      const docSnap = await getDoc(docRef);

      let roomBookings = [];
      if (docSnap.exists()) {
        roomBookings = docSnap.data()[selectedRoom.id] || [];
        // Check for conflicts: same room, same date, same time
        const isConflict = roomBookings.some(
          (b) => b.time === newBooking.time && b.status !== 'rejected'
        );
        if (isConflict) {
          setFeedbackMessage('This room is already booked for the selected time. Please choose another slot.');
          setFeedbackType('error');
          setIsLoading(false);
          return;
        }
      }

      await setDoc(docRef, {
        [selectedRoom.id]: arrayUnion(newBooking)
      }, { merge: true });

      setFeedbackMessage('Room booked successfully! Status: Pending approval.');
      setFeedbackType('success');
      setPurpose('');
      setSelectedTime(''); // Clear time selection
      fetchBookings(); // Refresh bookings list
    } catch (error) {
      console.error("Error booking room:", error);
      setFeedbackMessage('Failed to book room. Please try again.');
      setFeedbackType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const isTimeSlotBooked = (time) => {
    return bookings.some(
      (b) => b.time === time && b.status !== 'rejected'
    );
  };

  const getAvailableTimeSlots = () => {
    const timeSlots = [];
    for (let h = 8; h <= 17; h++) { // 8 AM to 5 PM
      for (let m = 0; m < 60; m += 30) { // Every 30 minutes
        const hour = h < 10 ? `0${h}` : `${h}`;
        const minute = m < 10 ? `0${m}` : `${m}`;
        const time = `${hour}:${minute}`;
        timeSlots.push(time);
      }
    }
    return timeSlots;
  };

  const timeSlots = getAvailableTimeSlots();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-inter">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-3xl font-bold text-gray-800">Booking: {selectedRoom.name}</h2>
          <button
            onClick={onBackToRooms}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline"
          >
            Back to Rooms
          </button>
        </div>

        {feedbackMessage && (
          <div className={`p-3 mb-4 rounded-md ${feedbackType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {feedbackMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Booking Form */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-gray-800">New Booking Request</h3>
            <form onSubmit={handleBookRoom} className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="date">
                  Date
                </label>
                <input
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={today}
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="time">
                  Time
                </label>
                <select
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  required
                >
                  <option value="">Select a time</option>
                  {timeSlots.map(time => (
                    <option key={time} value={time} disabled={selectedDate && isTimeSlotBooked(time)}>
                      {time} {selectedDate && isTimeSlotBooked(time) ? '(Booked)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="purpose">
                  Purpose
                </label>
                <textarea
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  id="purpose"
                  rows="3"
                  placeholder="e.g., Team meeting, Presentation, Study group"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                ></textarea>
              </div>
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Booking...' : 'Submit Booking Request'}
              </button>
            </form>
          </div>

          {/* Existing Bookings */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Bookings for {formatDateForDisplay(selectedDate)}</h3>
            {isLoading && <p className="text-gray-600">Loading bookings...</p>}
            {!isLoading && bookings.length === 0 && selectedDate && (
              <p className="text-gray-600">No bookings for this date and room.</p>
            )}
            {!selectedDate && (
              <p className="text-gray-600">Please select a date to view bookings.</p>
            )}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {bookings
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((booking) => (
                <div key={booking.id} className="bg-gray-50 p-3 rounded-md shadow-sm">
                  <p className="font-semibold text-gray-800">Time: {booking.time}</p>
                  <p className="text-gray-700 text-sm">Purpose: {booking.purpose}</p>
                  <p className="text-gray-700 text-sm">Booked by: {booking.schoolId}</p>
                  <p className={`text-sm font-medium ${booking.status === 'approved' ? 'text-green-600' : booking.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                    Status: {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="mt-8 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline block mx-auto"
      >
        Logout
      </button>
    </div>
  );
}

function RoomList({ user, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      setIsLoading(true);
      try {
        const roomsRef = collection(db, `artifacts/${appId}/public/data/rooms`);
        const querySnapshot = await getDocs(roomsRef);
        const fetchedRooms = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (fetchedRooms.length === 0) {
          // If no rooms exist, add default rooms
          console.log("No rooms found, adding default rooms.");
          const batch = writeBatch(db);
          defaultRooms.forEach(room => {
            const roomDocRef = doc(db, `artifacts/${appId}/public/data/rooms`, room.id);
            batch.set(roomDocRef, room);
          });
          await batch.commit();
          setRooms(defaultRooms); // Set state with default rooms
        } else {
          setRooms(fetchedRooms);
        }
      } catch (error) {
        console.error("Error fetching or setting default rooms:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRooms();
  }, []);

  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
  };

  const handleBackToRooms = () => {
    setSelectedRoom(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
        <p className="text-gray-700 text-lg">Loading rooms...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-inter">
      {selectedRoom ? (
        <RoomBooking
          user={user}
          onLogout={onLogout}
          selectedRoom={selectedRoom}
          onBackToRooms={handleBackToRooms}
        />
      ) : (
        <>
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800">Welcome, {user.schoolId}!</h1>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline"
            >
              Logout
            </button>
          </div>
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Available Rooms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onSelectRoom={handleSelectRoom} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AdminPanel({ user, onLogout }) {
  const [allBookings, setAllBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState('');

  const fetchAllBookings = useCallback(async () => {
    setIsLoading(true);
    setFeedbackMessage('');
    setFeedbackType('');
    try {
      const bookingsCollectionRef = collection(db, `artifacts/${appId}/public/data/bookings`);
      const querySnapshot = await getDocs(bookingsCollectionRef);
      let fetchedBookings = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        Object.keys(data).forEach(roomId => {
          const roomBookings = data[roomId];
          roomBookings.forEach(booking => {
            fetchedBookings.push({ ...booking, docId: docSnap.id }); // docId is the dateKey
          });
        });
      });
      setAllBookings(fetchedBookings.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.time.localeCompare(b.time)));
    } catch (error) {
      console.error("Error fetching all bookings:", error);
      setFeedbackMessage("Failed to load all bookings.");
      setFeedbackType('error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllBookings();
  }, [fetchAllBookings]);

  const updateBookingStatus = async (bookingToUpdate, newStatus) => {
    setFeedbackMessage('');
    setFeedbackType('');
    setIsLoading(true);
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/bookings`, bookingToUpdate.docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const roomBookings = data[bookingToUpdate.roomId] || [];
        const updatedRoomBookings = roomBookings.map(b =>
          b.id === bookingToUpdate.id ? { ...b, status: newStatus } : b
        );

        await updateDoc(docRef, {
          [bookingToUpdate.roomId]: updatedRoomBookings
        });
        setFeedbackMessage(`Booking for ${bookingToUpdate.roomName} (${bookingToUpdate.time}) on ${formatDateForDisplay(bookingToUpdate.date)} ${newStatus}ed.`);
        setFeedbackType('success');
        fetchAllBookings(); // Refresh the list
      }
    } catch (error) {
      console.error(`Error updating booking status to ${newStatus}:`, error);
      setFeedbackMessage(`Failed to update booking status to ${newStatus}.`);
      setFeedbackType('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
        <p className="text-gray-700 text-lg">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-inter">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-3xl font-bold text-gray-800">Admin Panel</h2>
          <button
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline"
          >
            Logout
          </button>
        </div>

        {feedbackMessage && (
          <div className={`p-3 mb-4 rounded-md ${feedbackType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {feedbackMessage}
          </div>
        )}

        <h3 className="text-xl font-semibold mb-4 text-gray-800">All Room Bookings</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-md">
            <thead>
              <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                <th className="py-3 px-6 text-left">Room</th>
                <th className="py-3 px-6 text-left">Date</th>
                <th className="py-3 px-6 text-left">Time</th>
                <th className="py-3 px-6 text-left">Purpose</th>
                <th className="py-3 px-6 text-left">Booked By</th>
                <th className="py-3 px-6 text-left">Status</th>
                <th className="py-3 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm font-light">
              {allBookings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-3 px-6 text-center">No bookings found.</td>
                </tr>
              ) : (
                allBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-gray-200 hover:bg-gray-100">
                    <td className="py-3 px-6 text-left whitespace-nowrap">{booking.roomName}</td>
                    <td className="py-3 px-6 text-left">{formatDateForDisplay(booking.date)}</td>
                    <td className="py-3 px-6 text-left">{booking.time}</td>
                    <td className="py-3 px-6 text-left">{booking.purpose}</td>
                    <td className="py-3 px-6 text-left">{booking.schoolId}</td>
                    <td className="py-3 px-6 text-left">
                      <span className={`py-1 px-3 rounded-full text-xs font-semibold
                        ${booking.status === 'approved' ? 'bg-green-200 text-green-700' :
                          booking.status === 'rejected' ? 'bg-red-200 text-red-700' :
                          'bg-yellow-200 text-yellow-700'}`
                      }>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-center">
                      {booking.status === 'pending' && (
                        <div className="flex item-center justify-center gap-2">
                          <button
                            onClick={() => updateBookingStatus(booking, 'approved')}
                            className="bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-md text-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateBookingStatus(booking, 'rejected')}
                            className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md text-xs"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Root() { // <--- Ensure 'export default' is here and the function starts
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const userRoleRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Fetch user's role from Firestore
        const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, currentUser.email.split('@')[0]);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          userRoleRef.current = userData.role; // Store role in ref for immediate access
          setUser({
            uid: currentUser.uid,
            email: currentUser.email,
            schoolId: currentUser.email.split('@')[0], // Extract schoolId from email
            role: userData.role,
          });
        } else {
            console.log("No user profile found in Firestore for:", currentUser.email.split('@')[0]);
            setUser(null); // No profile, treat as not fully logged in
        }
      } else {
        setUser(null);
        userRoleRef.current = null;
      }
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription
  }, []);

  const handleLogin = (schoolId) => {
    // onAuthStateChanged handles setting the user state, this is just for feedback
    console.log("Login successful for:", schoolId);
    setShowCreateAccount(false); // Ensure we're not on create account screen
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null); // Clear user state
      userRoleRef.current = null; // Clear user role ref
      setShowCreateAccount(false); // Go back to login form
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleCreateAccountClick = () => {
    setShowCreateAccount(true);
  };

  const handleBackToLogin = () => {
    setShowCreateAccount(false);
  };

  if (loading) { // <--- This 'if' statement must be inside the function body
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
        <p className="text-gray-700 text-lg">Loading application...</p>
      </div>
    );
  }

  // Main render logic based on user authentication and role
  if (!user) {
    return showCreateAccount ? (
      <CreateAccount onBackToLogin={handleBackToLogin} />
    ) : (
      <Login onLogin={handleLogin} onCreateAccount={handleCreateAccountClick} />
    );
  }

  // Render components based on user role
  if (userRoleRef.current === 'admin') {
    return <AdminPanel user={user} onLogout={handleLogout} />;
  } else {
    // Default to patron view for any other role or if role is not found
    return <RoomList user={user} onLogout={handleLogout} />;
  }
}