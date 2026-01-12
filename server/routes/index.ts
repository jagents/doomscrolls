import { Hono } from 'hono';
import { feed } from './feed';
import { passages } from './passages';
import { authors } from './authors';
import { works } from './works';
import { categories } from './categories';
import { discover } from './discover';
import { admin } from './admin';
import { auth } from './auth';
import { user } from './user';
import { lists } from './lists';
import { search } from './search';

const routes = new Hono();

// Auth routes
routes.route('/auth', auth);

// User data routes (requires auth)
routes.route('/user', user);

// Content routes
routes.route('/feed', feed);
routes.route('/passages', passages);
routes.route('/authors', authors);
routes.route('/works', works);
routes.route('/categories', categories);
routes.route('/discover', discover);

// Lists
routes.route('/lists', lists);

// Search
routes.route('/search', search);

// Admin
routes.route('/admin', admin);

export { routes };
