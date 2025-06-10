import nodemailer from 'nodemailer';
import pug from 'pug';
import { convert } from 'html-to-text';
import Logger from "../Utils/Logger.js"; // Assurez-vous que le chemin d'accès est correct

const emailConfig = {
  production: {
    service: 'SendGrid',
    auth: {
      user: process.env.SENDGRID_USERNAME,
      pass: process.env.SENDGRID_PASSWORD
    }
  },
  development: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  }
};

class Mailer {
  constructor() {
    this.from = `Ecommerce <${process.env.EMAIL_FROM}>`;
    this.logger = new Logger();
  }

  setRecipient(email, name = '') {
    this.to = email;
    this.firstName = name ? name.split(' ')[0] : '';
    return this;
  }

  setUrl(url) {
    this.url = url;
    return this;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Sendgrid
      return nodemailer.createTransport(emailConfig.production);
    }

    // Utilisez la configuration de développement
    return nodemailer.createTransport(emailConfig.development);
  }

  async send(template, subject, templateData = {}) { // Ajout de templateData
    try {
      // 1) Rendre le HTML à partir d'un modèle Pug
      const html = pug.renderFile(`${__dirname}/../Views/email/${template}.pug`, {
        firstName: this.firstName,
        url: this.url,
        subject,
        ...templateData // Passer les données du modèle
      });

      // 2) Définir les options de l'e-mail
      const mailOptions = {
        from: this.from,
        to: this.to,
        subject,
        html,
        text: convert(html)
      };

      // 3) Créer un transport et envoyer l'e-mail
      await this.newTransport().sendMail(mailOptions);
      this.logger.logger.info(`Email envoyé: ${subject} à ${this.to}`); // Journalisation
    } catch (error) {
      this.logger.logger.error(`Erreur lors de l'envoi de l'e-mail: ${error.message}`, { error });
      throw error; // Relancer l'erreur pour une gestion plus poussée
    }
  }

  async sendWelcome() {
    await this.send('welcome', 'Bienvenue sur notre plateforme e-commerce!');
  }

  async sendPasswordReset() {
    await this.send('passwordReset', 'Votre token de réinitialisation de mot de passe (valide 10 minutes)');
  }

  async sendOrderConfirmation(order) {
    await this.send('orderConfirmation', 'Confirmation de votre commande', { order }); // Passer les données de la commande
  }

  async sendEmail(options) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD
        }
      });
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: options.email,
        subject: options.subject,
        text: options.message
      };
      await transporter.sendMail(mailOptions);
       this.logger.logger.info(`Email envoyé: ${options.subject} à ${options.email}`); // Journalisation
    } catch (err) {
      this.logger.logger.error(`Erreur d'envoi d'email: ${err.message}`, { err });
      throw err;
    }
  }
}

export default Mailer;