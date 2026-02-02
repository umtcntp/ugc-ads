import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_BASEURL || 'http://localhost:5050',
});

export default api;