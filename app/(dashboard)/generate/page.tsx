"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { SplitTimeline } from "@/components/generate/SplitTimeline";
import { LinkResult } from "@/components/generate/LinkResult";
import { Zap, AlertTriangle, Info } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { useUser } from "@/lib/user-context";
import type { WhopProduct, PaymentType, SplitMode } from "@/lib/types";

interface Closer {
  id: string;
  name: string;
  email: string;
  commissionType: string;
  commissionValue: number;
  isActive: boolean;
}

const BILLING_OPTIONS = [
  { value: "7", label: "Weekly (7 days)" },
  { value: "14", label: "Bi-weekly (14 days)" },
  { value: "30", label: "Monthly (30 days)" },
  { value: "90", label: "Quarterly (90 days)" },
  { value: "custom", label: "Custom interval" },
];

export default function GenerateLinkPage() {
  const currentUser = useUser();
  const isCloserRole = currentUser?.role === "closer";

  // State
  const [closers, setClosers] = useState<Closer[]>([]);
  const [products, setProducts] = useState<WhopProduct[]>([]);
  const [loadingClosers, setLoadingClosers] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Form fields — pre-fill closerId for closer role (user IS the closer)
  const [closerId, setCloserId] = useState(isCloserRole ? (currentUser?.userId || "") : "");
  const [productId, setProductId] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("one_time");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // One-time
  const [amount, setAmount] = useState("");

  // Recurring
  const [renewalPrice, setRenewalPrice] = useState("");
  const [billingInterval, setBillingInterval] = useState("30");
  const [customDays, setCustomDays] = useState("");

  // Split pay
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [totalAmount, setTotalAmount] = useState("");
  const [numberOfPayments, setNumberOfPayments] = useState("2");
  const [initialPrice, setInitialPrice] = useState("");
  const [remainingAmount, setRemainingAmount] = useState("");

  const billingPeriodDays =
    billingInterval === "custom" ? parseInt(customDays) || 30 : parseInt(billingInterval);

  // Load data
  useEffect(() => {
    if (isCloserRole) {
      // Closer role: auto-select themselves — user IS the closer
      if (currentUser?.userId) {
        setCloserId(currentUser.userId);
        setClosers([{
          id: currentUser.userId,
          name: currentUser.name,
          email: currentUser.email,
          commissionType: "",
          commissionValue: 0,
          isActive: true,
        }]);
      }
      setLoadingClosers(false);
    } else {
      fetch("/api/closers")
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setClosers(d.data.filter((c: Closer) => c.isActive !== false));
        })
        .catch(console.error)
        .finally(() => setLoadingClosers(false));
    }

    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProducts(d.data);
      })
      .catch(console.error)
      .finally(() => setLoadingProducts(false));
  }, [isCloserRole, currentUser]);

  // Calculated values
  const selectedCloser = closers.find((c) => c.id === closerId);
  const selectedProduct = products.find((p) => p.id === productId);

  const getEqualInstallmentAmount = useCallback(() => {
    const total = parseFloat(totalAmount);
    const numPay = parseInt(numberOfPayments);
    if (!total || !numPay || numPay < 2) return 0;
    return Math.round((total / numPay) * 100) / 100;
  }, [totalAmount, numberOfPayments]);

  const getCustomInstallmentPrice = useCallback(() => {
    const remaining = parseFloat(remainingAmount) || 0;
    const numPay = parseInt(numberOfPayments) || 2;
    const numInstallments = numPay - 1;
    if (numInstallments <= 0 || remaining <= 0) return 0;
    return Math.round((remaining / numInstallments) * 100) / 100;
  }, [remainingAmount, numberOfPayments]);

  const getCustomTotal = useCallback(() => {
    const init = parseFloat(initialPrice) || 0;
    const remaining = parseFloat(remainingAmount) || 0;
    return init + remaining;
  }, [initialPrice, remainingAmount]);

  const handleGenerate = async () => {
    if (!closerId || !productId) {
      toast.error("Please select a closer and product");
      return;
    }

    setGenerating(true);

    try {
      const body: Record<string, unknown> = {
        closerId,
        productId,
        productName: selectedProduct?.title || "Unknown Product",
        paymentType,
        title: title || undefined,
        description: description || undefined,
        billingPeriodDays,
      };

      if (paymentType === "one_time") {
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) {
          toast.error("Please enter a valid amount");
          setGenerating(false);
          return;
        }
        body.amount = amt;
      } else if (paymentType === "renewal") {
        const price = parseFloat(renewalPrice);
        if (!price || price <= 0) {
          toast.error("Please enter a valid renewal price");
          setGenerating(false);
          return;
        }
        body.renewalPrice = price;
      } else if (paymentType === "split_pay") {
        const numPay = parseInt(numberOfPayments);
        if (!numPay || numPay < 2) {
          toast.error("Number of payments must be at least 2");
          setGenerating(false);
          return;
        }
        body.numberOfPayments = numPay;
        body.splitMode = splitMode;

        if (splitMode === "equal") {
          const total = parseFloat(totalAmount);
          if (!total || total <= 0) {
            toast.error("Please enter a valid total amount");
            setGenerating(false);
            return;
          }
          body.totalAmount = total;
        } else {
          const init = parseFloat(initialPrice);
          const remaining = parseFloat(remainingAmount);
          if (!init || init <= 0 || !remaining || remaining <= 0) {
            toast.error("Please enter valid payment amounts");
            setGenerating(false);
            return;
          }
          const installment = getCustomInstallmentPrice();
          if (installment <= 0) {
            toast.error("Could not calculate installment amount");
            setGenerating(false);
            return;
          }
          body.initialPrice = init;
          body.installmentPrice = installment;
        }
      }

      const response = await fetch("/api/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        setGeneratedUrl(result.data.purchaseUrl);
        toast.success("Payment link generated!");
      } else {
        toast.error(result.error || "Failed to generate link");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setGeneratedUrl(null);
    setAmount("");
    setRenewalPrice("");
    setTotalAmount("");
    setInitialPrice("");
    setRemainingAmount("");
    setTitle("");
    setDescription("");
  };

  if (generatedUrl) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <LinkResult url={generatedUrl} onReset={handleReset} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Step 1: Select Closer (hidden for closer-role users) */}
      {!isCloserRole && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-cyber-cyan/20 flex items-center justify-center text-xs font-bold text-cyber-cyan">
              1
            </div>
            <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
              Select Closer
            </h3>
          </div>
          {loadingClosers ? (
            <div className="h-10 animate-shimmer rounded-lg" />
          ) : closers.length === 0 ? (
            <div className="flex items-center gap-2 text-cyber-yellow text-sm p-3 bg-cyber-yellow/5 border border-cyber-yellow/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>No closers found. Add closers in Settings first.</span>
            </div>
          ) : (
            <Select
              options={closers.map((c) => ({
                value: c.id,
                label: `${c.name} (${c.commissionType === "percentage" ? `${c.commissionValue}%` : `$${c.commissionValue}`} commission)`,
              }))}
              value={closerId}
              onChange={(e) => setCloserId(e.target.value)}
              placeholder="Choose a closer..."
            />
          )}
          {selectedCloser && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="cyan">
                {selectedCloser.commissionType === "percentage"
                  ? `${selectedCloser.commissionValue}% commission`
                  : `$${selectedCloser.commissionValue} per sale`}
              </Badge>
            </div>
          )}
        </Card>
      )}

      {/* Step 2: Select Product */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-cyber-cyan/20 flex items-center justify-center text-xs font-bold text-cyber-cyan">
            {isCloserRole ? 1 : 2}
          </div>
          <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
            Select Product
          </h3>
        </div>
        {loadingProducts ? (
          <div className="h-10 animate-shimmer rounded-lg" />
        ) : products.length === 0 ? (
          <div className="flex items-center gap-2 text-cyber-yellow text-sm p-3 bg-cyber-yellow/5 border border-cyber-yellow/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>No products found. Make sure your Whop API key is configured and you have products created on Whop.</span>
          </div>
        ) : (
          <Select
            options={products.map((p) => ({
              value: p.id,
              label: p.title,
            }))}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="Choose a product..."
          />
        )}
      </Card>

      {/* Step 3: Payment Configuration */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-cyber-cyan/20 flex items-center justify-center text-xs font-bold text-cyber-cyan">
            {isCloserRole ? 2 : 3}
          </div>
          <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
            Payment Configuration
          </h3>
        </div>

        {/* Payment Type Selector */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { value: "one_time" as const, label: "One-Time", desc: "Single charge" },
            { value: "renewal" as const, label: "Recurring", desc: "Ongoing subscription" },
            { value: "split_pay" as const, label: "Split Payment", desc: "Fixed installments" },
          ].map((type) => (
            <button
              key={type.value}
              onClick={() => setPaymentType(type.value)}
              className={`p-3 rounded-lg border transition-all text-left ${
                paymentType === type.value
                  ? "border-cyber-cyan bg-cyber-cyan/10 text-white"
                  : "border-cyber-border bg-cyber-black text-cyber-muted hover:border-cyber-border hover:bg-white/5"
              }`}
            >
              <p className="text-sm font-medium">{type.label}</p>
              <p className="text-xs mt-0.5 opacity-60">{type.desc}</p>
            </button>
          ))}
        </div>

        {/* One-Time Fields */}
        {paymentType === "one_time" && (
          <div className="space-y-4">
            <Input
              label="Amount"
              prefix="$"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
        )}

        {/* Recurring Fields */}
        {paymentType === "renewal" && (
          <div className="space-y-4">
            <Input
              label="Amount per Period"
              prefix="$"
              type="number"
              placeholder="0.00"
              value={renewalPrice}
              onChange={(e) => setRenewalPrice(e.target.value)}
              min="0"
              step="0.01"
            />
            <Select
              label="Billing Interval"
              options={BILLING_OPTIONS}
              value={billingInterval}
              onChange={(e) => setBillingInterval(e.target.value)}
            />
            {billingInterval === "custom" && (
              <Input
                label="Custom Interval (days)"
                type="number"
                placeholder="30"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                min="1"
              />
            )}
          </div>
        )}

        {/* Split Payment Fields */}
        {paymentType === "split_pay" && (
          <div className="space-y-4">
            {/* Split Mode Toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSplitMode("equal")}
                className={`p-2.5 rounded-lg border text-sm transition-all ${
                  splitMode === "equal"
                    ? "border-cyber-purple bg-cyber-purple/10 text-white"
                    : "border-cyber-border bg-cyber-black text-cyber-muted"
                }`}
              >
                Equal Installments
              </button>
              <button
                onClick={() => setSplitMode("custom")}
                className={`p-2.5 rounded-lg border text-sm transition-all ${
                  splitMode === "custom"
                    ? "border-cyber-purple bg-cyber-purple/10 text-white"
                    : "border-cyber-border bg-cyber-black text-cyber-muted"
                }`}
              >
                Custom Split
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Number of Payments"
                type="number"
                placeholder="2"
                value={numberOfPayments}
                onChange={(e) => setNumberOfPayments(e.target.value)}
                min="2"
                max="12"
              />
              <Select
                label="Billing Interval"
                options={BILLING_OPTIONS}
                value={billingInterval}
                onChange={(e) => setBillingInterval(e.target.value)}
              />
            </div>

            {billingInterval === "custom" && (
              <Input
                label="Custom Interval (days)"
                type="number"
                placeholder="30"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                min="1"
              />
            )}

            {splitMode === "equal" ? (
              <>
                <Input
                  label="Total Amount"
                  prefix="$"
                  type="number"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
                {parseFloat(totalAmount) > 0 && parseInt(numberOfPayments) >= 2 && (
                  <div className="p-3 bg-cyber-cyan/5 border border-cyber-cyan/20 rounded-lg">
                    <p className="text-sm text-cyber-cyan font-[family-name:var(--font-jetbrains)]">
                      Customer pays{" "}
                      <strong>{formatCurrency(getEqualInstallmentAmount())}</strong>{" "}
                      × {numberOfPayments} installments ={" "}
                      <strong>{formatCurrency(parseFloat(totalAmount))}</strong> total
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <Input
                  label="First Payment (Today)"
                  prefix="$"
                  type="number"
                  placeholder="0.00"
                  value={initialPrice}
                  onChange={(e) => setInitialPrice(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <Input
                  label="Remaining Amount"
                  prefix="$"
                  type="number"
                  placeholder="0.00"
                  value={remainingAmount}
                  onChange={(e) => setRemainingAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />

                {parseFloat(remainingAmount) > 0 && parseInt(numberOfPayments) >= 2 && (
                  <div className="p-3 bg-cyber-cyan/5 border border-cyber-cyan/20 rounded-lg">
                    <p className="text-sm text-cyber-cyan font-[family-name:var(--font-jetbrains)]">
                      Remaining {formatCurrency(parseFloat(remainingAmount))} split across{" "}
                      {parseInt(numberOfPayments) - 1} payments ={" "}
                      <strong>{formatCurrency(getCustomInstallmentPrice())}</strong> each
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-2 p-3 bg-cyber-purple/5 border border-cyber-purple/20 rounded-lg">
                  <Info className="w-4 h-4 text-cyber-purple flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-cyber-purple">
                    <strong>Whop platform requirement:</strong> Payments 2+ will all be the same amount.
                    Only the first payment can differ from subsequent ones.
                  </p>
                </div>

                {parseFloat(initialPrice) > 0 &&
                  parseFloat(remainingAmount) > 0 &&
                  parseInt(numberOfPayments) >= 2 && (
                    <SplitTimeline
                      initialPrice={parseFloat(initialPrice)}
                      installmentPrice={getCustomInstallmentPrice()}
                      numberOfPayments={parseInt(numberOfPayments)}
                      billingPeriodDays={billingPeriodDays}
                    />
                  )}
              </>
            )}
          </div>
        )}

      </Card>

      {/* Step 4: Review & Generate */}
      <Card glow>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-cyber-cyan/20 flex items-center justify-center text-xs font-bold text-cyber-cyan">
            {isCloserRole ? 3 : 4}
          </div>
          <h3 className="font-[family-name:var(--font-orbitron)] text-sm font-semibold text-white">
            Review & Generate
          </h3>
        </div>

        {/* Summary */}
        <div className="bg-cyber-black rounded-lg p-4 mb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-cyber-muted">Closer</span>
            <span className="text-white">{selectedCloser?.name || "Not selected"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyber-muted">Product</span>
            <span className="text-white">{selectedProduct?.title || "Not selected"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyber-muted">Type</span>
            <span className="text-white capitalize">
              {paymentType === "one_time"
                ? "One-Time Payment"
                : paymentType === "renewal"
                ? "Recurring Subscription"
                : splitMode === "custom"
                ? "Custom Split Payment"
                : "Equal Split Payment"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyber-muted">Amount</span>
            <span className="font-[family-name:var(--font-jetbrains)] text-cyber-cyan">
              {paymentType === "one_time"
                ? formatCurrency(parseFloat(amount) || 0)
                : paymentType === "renewal"
                ? `${formatCurrency(parseFloat(renewalPrice) || 0)}/period`
                : splitMode === "equal"
                ? formatCurrency(parseFloat(totalAmount) || 0)
                : formatCurrency(getCustomTotal())}
            </span>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          loading={generating}
          disabled={!closerId || !productId}
          size="lg"
          className="w-full animate-pulse-glow"
        >
          <Zap className="w-5 h-5 mr-2" />
          Generate Payment Link
        </Button>
      </Card>
    </div>
  );
}
