import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
    'accept': 'application/json',
  },
});

export const api = {
  getProducts: async () => {
    const res = await apiClient.get('/products');
    return res.data;
  },
  getProductById: async (id) => {
    const res = await apiClient.get(`/products/${id}`);
    return res.data;
  },
  createProduct: async (product) => {
    const res = await apiClient.post('/products', product);
    return res.data;
  },
  updateProduct: async (id, product) => {
    const res = await apiClient.patch(`/products/${id}`, product);
    return res.data;
  },
  deleteProduct: async (id) => {
    await apiClient.delete(`/products/${id}`);
  },
};