import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import styles from './SplashScreen.module.css';
import logoEjc from '../../assets/logo-ejc.svg';

interface SplashScreenProps {
  isVisible: boolean;
  onFinished?: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] }
  }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: "spring",
      damping: 20,
      stiffness: 100
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      type: "spring",
      damping: 15,
      stiffness: 200
    }
  }
};

/**
 * Premium SplashScreen component (v2.0)
 * Uses mesh gradients, glassmorphism and refined motion for a high-end feel.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ isVisible, onFinished }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      // Reset progress when not visible so it starts from 0 next time
      setProgress(0);
      return;
    }

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) return prev;
        // Natural ease-out loading feel
        const diff = Math.max(0.05, (100 - prev) / 25);
        return prev + diff;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <AnimatePresence onExitComplete={onFinished}>
      {isVisible && (
        <motion.div
          className={styles.splashContainer}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-busy="true"
          role="status"
        >
          {/* Animated Mesh Layer */}
          <motion.div 
            className={styles.meshBackground}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5 }}
          />
          
          <motion.div 
            className={styles.glassCard}
            variants={cardVariants}
          >
            <motion.div 
              className={styles.logoContainer}
              variants={itemVariants}
            >
              <img src={logoEjc} alt="Logo EJC" className={styles.logo} />
            </motion.div>

            <motion.div 
              className={styles.progressWrapper}
              variants={itemVariants}
            >
              <motion.div 
                className={styles.progressBar}
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
