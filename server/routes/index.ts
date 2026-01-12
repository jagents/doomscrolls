import { Hono } from 'hono';
import { feed } from './feed';
import { passages } from './passages';
import { authors } from './authors';
import { works } from './works';
import { categories } from './categories';
import { discover } from './discover';
import { admin } from './admin';

const routes = new Hono();

routes.route('/feed', feed);
routes.route('/passages', passages);
routes.route('/authors', authors);
routes.route('/works', works);
routes.route('/categories', categories);
routes.route('/discover', discover);
routes.route('/admin', admin);

export { routes };
