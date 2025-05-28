import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

// --- Firebase Context ---
// Create a context to provide Firebase instances and user info throughout the app
const FirebaseContext = createContext(null);

// Firebase Provider component
function FirebaseProvider({ children }) {
  const [app, setApp] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'patron', 'staff', 'admin'
  const [isAuthReady, setIsAuthReady] = useState(false);
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // Define appId here

  useEffect(() => {
    try {
      // Initialize Firebase app using global config
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
      const initializedApp = initializeApp(firebaseConfig);
      setApp(initializedApp);

      // Get Auth and Firestore instances
      const authInstance = getAuth(initializedApp);
      const dbInstance = getFirestore(initializedApp);
      setAuth(authInstance);
      setDb(dbInstance);

      // Sign in with custom token if available, otherwise anonymously
      const signInUser = async () => {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(authInstance, __initial_auth_token);
          } else {
            // If no custom token, we'll handle login via the LoginPage component
            // For now, ensure anonymous sign-in is attempted if not already authenticated
            if (!authInstance.currentUser) {
                await signInAnonymously(authInstance);
            }
          }
        } catch (error) {
          console.error("Firebase authentication error:", error);
          // Fallback to anonymous if custom token fails or other issues
          if (!authInstance.currentUser) {
              await signInAnonymously(authInstance);
          }
        }
      };

      signInUser();

      // Set up auth state listener
      const unsubscribe = onAuthStateChanged(authInstance, async (currentUser) => {
        if (currentUser) {
          setUserId(currentUser.uid);
          // Fetch user role from Firestore, using the defined appId
          const userDocRef = doc(dbInstance, `artifacts/${appId}/public/data/users`, currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserRole(userDocSnap.data().role);
          } else {
            // If user doesn't exist in DB, role will be set upon successful manual login
            // or remain null until then.
            setUserRole(null); // Explicitly set to null if not found
          }
        } else {
          setUserId(null);
          setUserRole(null);
        }
        setIsAuthReady(true); // Auth state is ready
      });

      return () => unsubscribe(); // Cleanup auth listener
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      setIsAuthReady(true); // Mark as ready even if initialization failed
    }
  }, [appId]); // Added appId to dependency array

  return (
    <FirebaseContext.Provider value={{ app, db, auth, userId, userRole, isAuthReady, appId }}>
      {children}
    </FirebaseContext.Provider>
  );
}

// Custom hook to use Firebase context
function useFirebase() {
  return useContext(FirebaseContext);
}

// --- UI Components ---

// Modal component for messages and confirmations
function Modal({ message, onClose, onConfirm, showConfirmButton = false }) {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full text-center">
        <p className="text-lg font-semibold mb-4">{message}</p>
        <div className="flex justify-center space-x-4">
          {showConfirmButton && (
            <button
              onClick={onConfirm}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-300 shadow-md"
            >
              Confirm
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-300 shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Login Page Component
function LoginPage({ onLoginSuccess }) {
  const { db, auth, userId, appId, isAuthReady } = useFirebase();
  const [schoolId, setSchoolId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage(''); // Clear previous errors

    // Hardcoded credentials for testing
    const correctSchoolId = '2200647';
    const correctPassword = 'UBIAN2025';

    if (schoolId === correctSchoolId && password === correctPassword) {
      try {
        // Ensure user is authenticated (anonymously if not already)
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }
        // Update user document with the specific school ID and role
        const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, auth.currentUser.uid);
        await setDoc(userDocRef, {
          username: schoolId,
          role: 'patron', // Assign patron role on successful login
          createdAt: new Date(),
        }, { merge: true }); // Use merge to update if doc exists, create if not
        onLoginSuccess(); // Notify parent component of successful login
      } catch (error) {
        console.error("Error during login process:", error);
        setErrorMessage("An error occurred during login. Please try again.");
      }
    } else {
      setErrorMessage("Invalid School ID or Password.");
    }
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading authentication...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
        <h2 className="text-3xl font-extrabold text-blue-800 mb-6">Login</h2>
        <div className="mb-4">
          <input
            type="text"
            placeholder="School ID (e.g., 2200647)"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-lg"
          />
        </div>
        <div className="mb-6">
          <input
            type="password"
            placeholder="Password (e.g., UBIAN2025)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-lg"
          />
        </div>
        {errorMessage && (
          <p className="text-red-600 mb-4">{errorMessage}</p>
        )}
        <button
          onClick={handleLogin}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition duration-300 shadow-lg"
        >
          Login
        </button>
      </div>
    </div>
  );
}


// --- Main App Component ---
function App() {
  const { db, userId, userRole, isAuthReady, auth, appId } = useFirebase(); // Get appId from context

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]); // For admin view
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [roomName, setRoomName] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [editingRoom, setEditingRoom] = useState(null); // For staff/admin room editing

  const [modalMessage, setModalMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(() => () => {}); // Function to execute on confirm

  // State to control if the user has successfully logged in via the login page
  const [isLoggedInManually, setIsLoggedInManually] = useState(false);

  // Effect to add default rooms if they don't exist
  useEffect(() => {
    if (!db || !isAuthReady) return;

    const addDefaultRooms = async () => {
      const roomsColRef = collection(db, `artifacts/${appId}/public/data/rooms`);
      const q = query(roomsColRef, where("name", "in", ["Conference Room 1", "Conference Room 2"]));
      const querySnapshot = await getDocs(q);

      const existingRoomNames = querySnapshot.docs.map(doc => doc.data().name);

      if (!existingRoomNames.includes("Conference Room 1")) {
        await addDoc(roomsColRef, {
          name: "Conference Room 1",
          capacity: 10,
          description: "Standard conference room with projector.",
          createdAt: new Date().toISOString(),
        });
      }
      if (!existingRoomNames.includes("Conference Room 2")) {
        await addDoc(roomsColRef, {
          name: "Conference Room 2",
          capacity: 15,
          description: "Larger conference room with video conferencing.",
          createdAt: new Date().toISOString(),
        });
      }
    };

    addDefaultRooms();
  }, [db, isAuthReady, appId]);


  // --- Data Fetching with Real-time Listeners ---
  useEffect(() => {
    if (!db || !isAuthReady) return;

    // Fetch rooms
    const roomsColRef = collection(db, `artifacts/${appId}/public/data/rooms`);
    const unsubscribeRooms = onSnapshot(roomsColRef, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(roomsData);
    }, (error) => {
      console.error("Error fetching rooms:", error);
      setModalMessage("Failed to load rooms. Please try again.");
    });

    // Fetch bookings
    const bookingsColRef = collection(db, `artifacts/${appId}/public/data/bookings`);
    const unsubscribeBookings = onSnapshot(bookingsColRef, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookings(bookingsData);
    }, (error) => {
      console.error("Error fetching bookings:", error);
      setModalMessage("Failed to load bookings. Please try again.");
    });

    // Fetch users (for admin)
    const usersColRef = collection(db, `artifacts/${appId}/public/data/users`);
    const unsubscribeUsers = onSnapshot(usersColRef, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    }, (error) => {
      console.error("Error fetching users:", error);
      setModalMessage("Failed to load user data. Please try again.");
    });

    return () => {
      unsubscribeRooms();
      unsubscribeBookings();
      unsubscribeUsers();
    };
  }, [db, isAuthReady, appId]);

  // --- Utility Functions ---

  // Get room name by ID
  const getRoomName = (id) => {
    const room = rooms.find(r => r.id === id);
    return room ? room.name : 'Unknown Room';
  };

  // Get username by ID
  const getUsername = (id) => {
    const user = users.find(u => u.id === id);
    return user ? user.username : 'Unknown User';
  };

  // Check for booking conflicts
  const isTimeSlotBooked = (roomId, date, start, end, excludeBookingId = null) => {
    const requestedStart = new Date(`${date}T${start}:00`);
    const requestedEnd = new Date(`${date}T${end}:00`);

    return bookings.some(booking => {
      if (booking.roomId === roomId && booking.date === date && booking.status === 'approved' && booking.id !== excludeBookingId) {
        const existingStart = new Date(`${booking.date}T${booking.startTime}:00`);
        const existingEnd = new Date(`${booking.date}T${booking.endTime}:00`);

        // Check for overlap
        return (
          (requestedStart < existingEnd && requestedEnd > existingStart)
        );
      }
      return false;
    });
  };

  // --- Patron Functions ---

  // Handle room booking
  const handleBookRoom = async () => {
    if (!selectedRoomId || !selectedDate || !startTime || !endTime) {
      setModalMessage("Please fill in all booking details.");
      return;
    }

    if (new Date(`${selectedDate}T${startTime}:00`) >= new Date(`${selectedDate}T${endTime}:00`)) {
      setModalMessage("End time must be after start time.");
      return;
    }

    if (isTimeSlotBooked(selectedRoomId, selectedDate, startTime, endTime)) {
      setModalMessage("This time slot is already booked for this room. Please choose another.");
      return;
    }

    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/bookings`), {
        roomId: selectedRoomId,
        userId: userId,
        date: selectedDate,
        startTime: startTime,
        endTime: endTime,
        status: 'pending', // Bookings are pending approval by staff
        bookedAt: new Date().toISOString(),
      });
      setModalMessage("Booking request submitted successfully! Awaiting staff approval.");
      // Clear form
      setSelectedRoomId('');
      setStartTime('09:00');
      setEndTime('10:00');
    } catch (e) {
      console.error("Error adding document: ", e);
      setModalMessage("Failed to submit booking. Please try again.");
    }
  };

  // --- Staff Functions ---

  // Approve a booking
  const handleApproveBooking = async (bookingId) => {
    const bookingToApprove = bookings.find(b => b.id === bookingId);
    if (!bookingToApprove) {
      setModalMessage("Booking not found.");
      return;
    }

    // Re-check for conflicts before approving, in case another booking was approved concurrently
    if (isTimeSlotBooked(bookingToApprove.roomId, bookingToApprove.date, bookingToApprove.startTime, bookingToApprove.endTime, bookingId)) {
      setModalMessage("Approving this booking would create a conflict. Another booking occupies this slot.");
      return;
    }

    setShowConfirmModal(true);
    setModalMessage("Are you sure you want to approve this booking?");
    setConfirmAction(() => async () => {
      try {
        await updateDoc(doc(db, `artifacts/${appId}/public/data/bookings`, bookingId), {
          status: 'approved',
          approvedAt: new Date().toISOString(),
        });
        setModalMessage("Booking approved successfully!");
      } catch (e) {
        console.error("Error approving booking: ", e);
        setModalMessage("Failed to approve booking. Please try again.");
      } finally {
        setShowConfirmModal(false);
      }
    });
  };

  // Reject a booking
  const handleRejectBooking = async (bookingId) => {
    setShowConfirmModal(true);
    setModalMessage("Are you sure you want to reject this booking?");
    setConfirmAction(() => async () => {
      try {
        await updateDoc(doc(db, `artifacts/${appId}/public/data/bookings`, bookingId), {
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
        });
        setModalMessage("Booking rejected successfully!");
      } catch (e) {
        console.error("Error rejecting booking: ", e);
        setModalMessage("Failed to reject booking. Please try again.");
      } finally {
        setShowConfirmModal(false);
      }
    });
  };

  // Add a new room
  const handleAddRoom = async () => {
    if (!roomName || !roomCapacity || !roomDescription) {
      setModalMessage("Please fill in all room details.");
      return;
    }
    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/rooms`), {
        name: roomName,
        capacity: parseInt(roomCapacity),
        description: roomDescription,
        createdAt: new Date().toISOString(),
      });
      setModalMessage("Room added successfully!");
      // Clear form
      setRoomName('');
      setRoomCapacity('');
      setRoomDescription('');
    } catch (e) {
      console.error("Error adding room: ", e);
      setModalMessage("Failed to add room. Please try again.");
    }
  };

  // Edit an existing room
  const handleEditRoom = (room) => {
    setEditingRoom(room);
    setRoomName(room.name);
    setRoomCapacity(room.capacity);
    setRoomDescription(room.description);
  };

  // Update an existing room
  const handleUpdateRoom = async () => {
    if (!editingRoom || !roomName || !roomCapacity || !roomDescription) {
      setModalMessage("Please fill in all room details.");
      return;
    }
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/rooms`, editingRoom.id), {
        name: roomName,
        capacity: parseInt(roomCapacity),
        description: roomDescription,
        updatedAt: new Date().toISOString(),
      });
      setModalMessage("Room updated successfully!");
      // Clear form and exit editing mode
      setEditingRoom(null);
      setRoomName('');
      setRoomCapacity('');
      setRoomDescription('');
    } catch (e) {
      console.error("Error updating room: ", e);
      setModalMessage("Failed to update room. Please try again.");
    }
  };

  // Delete a room
  const handleDeleteRoom = async (roomId) => {
    setShowConfirmModal(true);
    setModalMessage("Are you sure you want to delete this room? All associated bookings will remain but refer to a deleted room.");
    setConfirmAction(() => async () => {
      try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/rooms`, roomId));
        setModalMessage("Room deleted successfully!");
      } catch (e) {
        console.error("Error deleting room: ", e);
        setModalMessage("Failed to delete room. Please try again.");
      } finally {
        setShowConfirmModal(false);
      }
    });
  };

  // --- Admin Functions ---

  // Generate a simple report (client-side aggregation)
  const generateReport = () => {
    const totalBookings = bookings.length;
    const approvedBookings = bookings.filter(b => b.status === 'approved').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const rejectedBookings = bookings.filter(b => b.status === 'rejected').length;

    const roomUsage = {};
    bookings.forEach(b => {
      if (b.status === 'approved') {
        const roomName = getRoomName(b.roomId);
        roomUsage[roomName] = (roomUsage[roomName] || 0) + 1;
      }
    });

    let report = `
      Total Bookings: ${totalBookings}
      Approved Bookings: ${approvedBookings}
      Pending Bookings: ${pendingBookings}
      Rejected Bookings: ${rejectedBookings}

      Room Usage (Approved Bookings):
    `;
    for (const room in roomUsage) {
      report += `\n- ${room}: ${roomUsage[room]} bookings`;
    }
    setModalMessage(report);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      setIsLoggedInManually(false); // Reset manual login state on logout
      setModalMessage("Logged out successfully.");
    } catch (error) {
      console.error("Error signing out:", error);
      setModalMessage("Failed to log out.");
    }
  };

  // Determine if the main app should be shown or the login page
  // If __initial_auth_token is provided (Canvas environment), assume auto-login.
  // Otherwise, require manual login.
  const shouldShowLoginPage = !(typeof __initial_auth_token !== 'undefined' && __initial_auth_token) && !isLoggedInManually;

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading application...</div>
      </div>
    );
  }

  if (shouldShowLoginPage || !userRole) { // Show login page if not auto-logged in or role not determined
    return <LoginPage onLoginSuccess={() => setIsLoggedInManually(true)} />;
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-4 font-inter text-gray-800">
      <Modal
        message={modalMessage}
        onClose={() => setModalMessage('')}
        onConfirm={confirmAction}
        showConfirmButton={showConfirmModal}
      />

      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-2xl p-8 mb-8">
        <h1 className="text-4xl font-extrabold text-center text-blue-800 mb-6">
          Library Conference Room Appointment System
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Logged in as: <span className="font-semibold">{userId}</span> (Role: <span className="font-semibold capitalize">{userRole}</span>)
          <button
            onClick={handleLogout}
            className="ml-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-300 shadow-md"
          >
            Logout
          </button>
        </p>

        {/* --- Patron View --- */}
        {userRole === 'patron' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Book a Room Section */}
            <div className="bg-blue-50 p-6 rounded-lg shadow-inner">
              <h2 className="text-2xl font-bold text-blue-700 mb-4">Book a Room</h2>
              <div className="mb-4">
                <label htmlFor="booking-date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  id="booking-date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="room-select" className="block text-sm font-medium text-gray-700 mb-1">Select Room</label>
                <select
                  id="room-select"
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Choose a Room --</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name} (Capacity: {room.capacity})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    id="start-time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    id="end-time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={handleBookRoom}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition duration-300 shadow-lg"
              >
                Submit Booking Request
              </button>
            </div>

            {/* My Bookings Section */}
            <div className="bg-purple-50 p-6 rounded-lg shadow-inner">
              <h2 className="text-2xl font-bold text-purple-700 mb-4">My Bookings</h2>
              {bookings.filter(b => b.userId === userId).length === 0 ? (
                <p className="text-gray-600">You have no bookings yet.</p>
              ) : (
                <ul className="space-y-3">
                  {bookings.filter(b => b.userId === userId).map(booking => (
                    <li key={booking.id} className="bg-white p-4 rounded-md shadow-sm border border-purple-200">
                      <p className="font-semibold text-lg">{getRoomName(booking.roomId)}</p>
                      <p className="text-gray-700">Date: {booking.date}</p>
                      <p className="text-gray-700">Time: {booking.startTime} - {booking.endTime}</p>
                      <p className={`font-bold mt-1 ${booking.status === 'approved' ? 'text-green-600' : booking.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                        Status: {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* --- Staff View --- */}
        {userRole === 'staff' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pending Bookings Section */}
            <div className="bg-yellow-50 p-6 rounded-lg shadow-inner">
              <h2 className="text-2xl font-bold text-yellow-700 mb-4">Pending Booking Requests</h2>
              {bookings.filter(b => b.status === 'pending').length === 0 ? (
                <p className="text-gray-600">No pending booking requests.</p>
              ) : (
                <ul className="space-y-3">
                  {bookings.filter(b => b.status === 'pending').map(booking => (
                    <li key={booking.id} className="bg-white p-4 rounded-md shadow-sm border border-yellow-200">
                      <p className="font-semibold text-lg">{getRoomName(booking.roomId)}</p>
                      <p className="text-gray-700">Date: {booking.date}</p>
                      <p className="text-gray-700">Time: {booking.startTime} - {booking.endTime}</p>
                      <p className="text-gray-700">Requested by: {getUsername(booking.userId)}</p>
                      <div className="flex space-x-2 mt-3">
                        <button
                          onClick={() => handleApproveBooking(booking.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-300 shadow-md"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectBooking(booking.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-300 shadow-md"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Manage Rooms Section */}
            <div className="bg-green-50 p-6 rounded-lg shadow-inner">
              <h2 className="text-2xl font-bold text-green-700 mb-4">Manage Rooms</h2>
              <div className="mb-6 border-b pb-4 border-green-200">
                <h3 className="text-xl font-semibold text-green-800 mb-3">{editingRoom ? 'Edit Room' : 'Add New Room'}</h3>
                <div className="mb-3">
                  <label htmlFor="room-name" className="block text-sm font-medium text-gray-700 mb-1">Room Name</label>
                  <input
                    type="text"
                    id="room-name"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., Conference Room A"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="room-capacity" className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    id="room-capacity"
                    value={roomCapacity}
                    onChange={(e) => setRoomCapacity(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., 10"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="room-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    id="room-description"
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    rows="3"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., Equipped with projector and whiteboard."
                  ></textarea>
                </div>
                {editingRoom ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={handleUpdateRoom}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-300 shadow-md"
                    >
                      Update Room
                    </button>
                    <button
                      onClick={() => { setEditingRoom(null); setRoomName(''); setRoomCapacity(''); setRoomDescription(''); }}
                      className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition duration-300 shadow-md"
                    >
                      Cancel Edit
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAddRoom}
                    className="w-full py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition duration-300 shadow-md"
                  >
                    Add Room
                  </button>
                )}
              </div>

              <h3 className="text-xl font-semibold text-green-800 mb-3">Existing Rooms</h3>
              {rooms.length === 0 ? (
                <p className="text-gray-600">No rooms added yet.</p>
              ) : (
                <ul className="space-y-3">
                  {rooms.map(room => (
                    <li key={room.id} className="bg-white p-4 rounded-md shadow-sm border border-green-200 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-lg">{room.name}</p>
                        <p className="text-gray-700 text-sm">Capacity: {room.capacity}</p>
                        <p className="text-gray-700 text-sm">{room.description}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditRoom(room)}
                          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-300 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-300 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* --- Admin View --- */}
        {userRole === 'admin' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* User Management (Simulated) */}
            <div className="bg-red-50 p-6 rounded-lg shadow-inner">
              <h2 className="text-2xl font-bold text-red-700 mb-4">User Management (Simulated)</h2>
              <p className="text-gray-600 mb-4">
                This section shows current users. In a real system, you'd manage roles and credentials here.
              </p>
              {users.length === 0 ? (
                <p className="text-gray-600">No users found.</p>
              ) : (
                <ul className="space-y-3">
                  {users.map(user => (
                    <li key={user.id} className="bg-white p-4 rounded-md shadow-sm border border-red-200">
                      <p className="font-semibold text-lg">{user.username}</p>
                      <p className="text-gray-700">Role: <span className="capitalize">{user.role}</span></p>
                      <p className="text-gray-700 text-sm">User ID: {user.id}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Reporting and Analytics */}
            <div className="bg-teal-50 p-6 rounded-lg shadow-inner">
              <h2 className="text-2xl font-bold text-teal-700 mb-4">Reporting and Analytics</h2>
              <p className="text-gray-600 mb-4">
                Generate reports on room usage and booking statistics.
              </p>
              <button
                onClick={generateReport}
                className="w-full py-3 bg-teal-600 text-white font-semibold rounded-md hover:bg-teal-700 transition duration-300 shadow-lg"
              >
                Generate Usage Report
              </button>
              <div className="mt-6">
                <h3 className="text-xl font-semibold text-teal-800 mb-3">All Bookings Overview</h3>
                {bookings.length === 0 ? (
                  <p className="text-gray-600">No bookings recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white rounded-md shadow-sm">
                      <thead>
                        <tr className="bg-gray-100 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">
                          <th className="py-3 px-4 rounded-tl-md">Room</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Time</th>
                          <th className="py-3 px-4">User</th>
                          <th className="py-3 px-4 rounded-tr-md">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map(booking => (
                          <tr key={booking.id} className="border-b border-gray-200 last:border-b-0">
                            <td className="py-3 px-4">{getRoomName(booking.roomId)}</td>
                            <td className="py-3 px-4">{booking.date}</td>
                            <td className="py-3 px-4">{booking.startTime} - {booking.endTime}</td>
                            <td className="py-3 px-4">{getUsername(booking.userId)}</td>
                            <td className={`py-3 px-4 font-semibold ${booking.status === 'approved' ? 'text-green-600' : booking.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Root component to wrap App with FirebaseProvider
export default function Root() {
  return (
    <FirebaseProvider>
      <App />
    </FirebaseProvider>
  );
}
